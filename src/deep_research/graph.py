import asyncio
from typing import Literal

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    filter_messages,
    get_buffer_string,
)
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from src.deep_research.configuration import Configuration
from src.deep_research.prompts import (
    clarify_with_user_instructions,
    compress_research_simple_human_message,
    compress_research_system_prompt,
    final_report_generation_prompt,
    lead_researcher_prompt,
    research_system_prompt,
    transform_messages_into_research_topic_prompt,
)
from src.deep_research.state import (
    AgentInputState,
    AgentState,
    ClarifyWithUser,
    ConductResearch,
    ResearchComplete,
    ResearcherOutputState,
    ResearcherState,
    ResearchQuestion,
    SupervisorState,
)
from src.deep_research.utils import (
    get_all_tools,
    get_api_key_for_model,
    get_notes_from_tool_calls,
    get_today_str,
    is_token_limit_exceeded,
    remove_up_to_last_ai_message,
    think_tool,
    get_configurable_llm
)

# Initialize the model (using our helper)
configurable_model = get_configurable_llm()

async def clarify_with_user(state: AgentState, config: RunnableConfig) -> Command[Literal["write_research_brief", "__end__"]]:
    """Analyze user messages and ask clarifying questions if the research scope is unclear."""
    configurable = Configuration.from_runnable_config(config)
    if not configurable.allow_clarification:
        return Command(goto="write_research_brief")
    
    messages = state["messages"]
    
    # Configure model with structured output
    clarification_model = (
        configurable_model
        .with_structured_output(ClarifyWithUser)
        # .with_retry(...) # Azure model might handle retries internally or we can add back if needed
    )
    
    prompt_content = clarify_with_user_instructions.format(
        messages=get_buffer_string(messages), 
        date=get_today_str()
    )
    response = await clarification_model.ainvoke([HumanMessage(content=prompt_content)])
    
    if response.need_clarification:
        return Command(
            goto=END, 
            update={"messages": [AIMessage(content=response.question)]}
        )
    else:
        return Command(
            goto="write_research_brief", 
            update={"messages": [AIMessage(content=response.verification)]}
        )


async def write_research_brief(state: AgentState, config: RunnableConfig) -> Command[Literal["research_supervisor"]]:
    """Transform user messages into a structured research brief."""
    configurable = Configuration.from_runnable_config(config)
    
    research_model = (
        configurable_model
        .with_structured_output(ResearchQuestion)
    )
    
    prompt_content = transform_messages_into_research_topic_prompt.format(
        messages=get_buffer_string(state.get("messages", [])),
        date=get_today_str()
    )
    response = await research_model.ainvoke([HumanMessage(content=prompt_content)])
    
    supervisor_system_prompt = lead_researcher_prompt.format(
        date=get_today_str(),
        max_concurrent_research_units=configurable.max_concurrent_research_units
    )
    
    return Command(
        goto="research_supervisor", 
        update={
            "research_brief": response.research_brief,
            "supervisor_messages": {
                "type": "override",
                "value": [
                    SystemMessage(content=supervisor_system_prompt),
                    HumanMessage(content=response.research_brief)
                ]
            }
        }
    )


async def supervisor(state: SupervisorState, config: RunnableConfig) -> Command[Literal["supervisor_tools"]]:
    """Lead research supervisor."""
    lead_researcher_tools = [ConductResearch, ResearchComplete, think_tool]
    
    research_model = configurable_model.bind_tools(lead_researcher_tools)
    
    supervisor_messages = state.get("supervisor_messages", [])
    response = await research_model.ainvoke(supervisor_messages)
    
    return Command(
        goto="supervisor_tools",
        update={
            "supervisor_messages": [response],
            "research_iterations": state.get("research_iterations", 0) + 1
        }
    )

async def supervisor_tools(state: SupervisorState, config: RunnableConfig) -> Command[Literal["supervisor", "__end__"]]:
    """Execute tools called by the supervisor."""
    configurable = Configuration.from_runnable_config(config)
    supervisor_messages = state.get("supervisor_messages", [])
    research_iterations = state.get("research_iterations", 0)
    most_recent_message = supervisor_messages[-1]
    
    exceeded_allowed_iterations = research_iterations > configurable.max_researcher_iterations
    no_tool_calls = not most_recent_message.tool_calls
    research_complete_tool_call = any(
        tool_call["name"] == "ResearchComplete" 
        for tool_call in most_recent_message.tool_calls
    )
    
    if exceeded_allowed_iterations or no_tool_calls or research_complete_tool_call:
        return Command(
            goto=END,
            update={
                "notes": get_notes_from_tool_calls(supervisor_messages),
                # "research_brief": state.get("research_brief", "") # Already in state
            }
        )
    
    all_tool_messages = []
    
    # Handle think_tool
    think_tool_calls = [
        tc for tc in most_recent_message.tool_calls 
        if tc["name"] == "think_tool"
    ]
    for tool_call in think_tool_calls:
        all_tool_messages.append(ToolMessage(
            content=f"Reflection recorded: {tool_call['args']['reflection']}",
            name="think_tool",
            tool_call_id=tool_call["id"]
        ))
    
    # Handle ConductResearch
    conduct_research_calls = [
        tc for tc in most_recent_message.tool_calls 
        if tc["name"] == "ConductResearch"
    ]
    
    update_payload = {"supervisor_messages": []}

    if conduct_research_calls:
        # Simple Loop instead of parallel asyncio gather for now to avoid complex async issues in this environment
        # and to respect "second agent" robustness.
        
        tool_results = []
        for tool_call in conduct_research_calls[:configurable.max_concurrent_research_units]:
            topic = tool_call["args"]["research_topic"]
            result = await researcher_subgraph.ainvoke({
                "researcher_messages": [HumanMessage(content=topic)],
                "research_topic": topic
            }, config)
            tool_results.append((result, tool_call))

        # Handle matches
        for observation, tool_call in tool_results:
            all_tool_messages.append(ToolMessage(
                content=observation.get("compressed_research", "Error"),
                name=tool_call["name"],
                tool_call_id=tool_call["id"]
            ))
            
        # Extract raw notes
        raw_notes_concat = "\n".join([
            "\n".join(obs.get("raw_notes", [])) 
            for obs, _ in tool_results
        ])
        if raw_notes_concat:
            update_payload["raw_notes"] = [raw_notes_concat]

    # Append all tool messages
    update_payload["supervisor_messages"].extend(all_tool_messages)
    
    return Command(
        goto="supervisor",
        update=update_payload
    ) 

# Supervisor Subgraph
supervisor_builder = StateGraph(SupervisorState, config_schema=Configuration)
supervisor_builder.add_node("supervisor", supervisor)
supervisor_builder.add_node("supervisor_tools", supervisor_tools)
supervisor_builder.add_edge(START, "supervisor")
supervisor_subgraph = supervisor_builder.compile()


async def researcher(state: ResearcherState, config: RunnableConfig) -> Command[Literal["researcher_tools"]]:
    """Individual researcher."""
    configurable = Configuration.from_runnable_config(config)
    researcher_messages = state.get("researcher_messages", [])
    
    tools = await get_all_tools(config)
    
    # Bind tools
    research_model = configurable_model.bind_tools(tools)
    
    # System prompt
    researcher_prompt = research_system_prompt.format(
        mcp_prompt=configurable.mcp_prompt or "", 
        date=get_today_str()
    )
    
    messages = [SystemMessage(content=researcher_prompt)] + researcher_messages
    response = await research_model.ainvoke(messages)
    
    return Command(
        goto="researcher_tools",
        update={
            "researcher_messages": [response],
            "tool_call_iterations": state.get("tool_call_iterations", 0) + 1
        }
    )

async def researcher_tools(state: ResearcherState, config: RunnableConfig) -> Command[Literal["researcher", "compress_research"]]:
    """Execute researcher tools."""
    configurable = Configuration.from_runnable_config(config)
    researcher_messages = state.get("researcher_messages", [])
    most_recent_message = researcher_messages[-1]
    
    has_tool_calls = bool(most_recent_message.tool_calls)
    
    if not has_tool_calls:
        return Command(goto="compress_research")
    
    tools = await get_all_tools(config)
    tools_by_name = {tool.name: tool for tool in tools}
    
    tool_outputs = []
    for tool_call in most_recent_message.tool_calls:
        tool = tools_by_name.get(tool_call["name"])
        if tool:
            try:
                res = await tool.ainvoke(tool_call["args"], config)
                tool_outputs.append(ToolMessage(
                    content=str(res),
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"]
                ))
            except Exception as e:
                tool_outputs.append(ToolMessage(
                     content=f"Error: {str(e)}",
                     name=tool_call["name"],
                     tool_call_id=tool_call["id"]
                ))
    
    exceeded = state.get("tool_call_iterations", 0) >= configurable.max_react_tool_calls
    comp_called = any(tc["name"] == "ResearchComplete" for tc in most_recent_message.tool_calls)
    
    if exceeded or comp_called:
        return Command(
            goto="compress_research",
            update={"researcher_messages": tool_outputs}
        )
    
    return Command(
        goto="researcher",
        update={"researcher_messages": tool_outputs}
    )

async def compress_research(state: ResearcherState, config: RunnableConfig):
    """Compress findings."""
    configurable = Configuration.from_runnable_config(config)
    # Using same model for compression
    synthesizer_model = configurable_model
    
    researcher_messages = state.get("researcher_messages", [])
    researcher_messages.append(HumanMessage(content=compress_research_simple_human_message))
    
    compression_prompt = compress_research_system_prompt.format(date=get_today_str())
    messages = [SystemMessage(content=compression_prompt)] + researcher_messages
    
    try:
        response = await synthesizer_model.ainvoke(messages)
        
        raw_notes = "\n".join([
            str(m.content) 
            for m in filter_messages(researcher_messages, include_types=["tool", "ai"])
        ])
        
        return {
            "compressed_research": str(response.content),
            "raw_notes": [raw_notes]
        }
    except Exception as e:
        return {
            "compressed_research": f"Error compressing: {e}",
            "raw_notes": [] # simplified
        }

# Researcher Subgraph
researcher_builder = StateGraph(ResearcherState, output=ResearcherOutputState, config_schema=Configuration)
researcher_builder.add_node("researcher", researcher)
researcher_builder.add_node("researcher_tools", researcher_tools)
researcher_builder.add_node("compress_research", compress_research)
researcher_builder.add_edge(START, "researcher")
researcher_builder.add_edge("compress_research", END)
researcher_subgraph = researcher_builder.compile()


async def final_report_generation(state: AgentState, config: RunnableConfig):
    """Generate final report."""
    notes = state.get("notes", [])
    findings = "\n".join(notes)
    
    # CRITICAL: Do NOT bind tools here. We want a plain text response.
    # We also do not want structured output constraints if they cause issues, 
    # but let's try a direct prompt first.
    
    final_report_prompt = final_report_generation_prompt.format(
        research_brief=state.get("research_brief", ""),
        findings=findings,
        date=get_today_str()
    )
    
    # Using `invoke` instead of `ainvoke` for simplicity or ensuring await if needed.
    # We strip any system instructions about tools from the model config if possible,
    # but here we just send a new HumanMessage.
    
    messages = [
        SystemMessage(content="You are a technical report writer. Write a markdown report based on the findings."), 
        HumanMessage(content=final_report_prompt)
    ]
    
    response = await configurable_model.ainvoke(messages)
    
    return {
        "final_report": response.content, 
        "messages": [response]
    }

# Main Deep Researcher Graph
deep_researcher_builder = StateGraph(AgentState, input=AgentInputState, config_schema=Configuration)
deep_researcher_builder.add_node("clarify_with_user", clarify_with_user)
deep_researcher_builder.add_node("write_research_brief", write_research_brief)
deep_researcher_builder.add_node("research_supervisor", supervisor_subgraph)
deep_researcher_builder.add_node("final_report_generation", final_report_generation)

deep_researcher_builder.add_edge(START, "clarify_with_user")
deep_researcher_builder.add_edge("research_supervisor", "final_report_generation")
deep_researcher_builder.add_edge("final_report_generation", END)

# Compile
graph = deep_researcher_builder.compile()

if __name__ == "__main__":
    # Test block
    pass
