from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState
from src.llm import get_llm
from src.tools.filesystem import list_files, read_file, write_file
from src.tools.search import grep_search

from src.tools.github import read_github_file

def coder_node(state: AgentState):
    """
    Agent responsible for writing code.
    """
    llm = get_llm()
    
    # Bind tools
    tools = [list_files, read_file, write_file, grep_search, read_github_file]
    llm_with_tools = llm.bind_tools(tools)
    
    current_plan = state.get("current_plan", "No plan provided.")
    user_request = state.get("user_request", "")
    review_feedback = state.get("review_feedback")
    
    system_prompt = f"""You are an Expert Software Engineer (Composer).
Your goal is to execute the implementation plan by writing high-quality code.
You have access to filesystem tools.

Current Plan:
{current_plan}

Instructions:
- Execute the plan IMMEDIATELY. Do not ask for clarification.
- If details are missing, make a reasonable assumption and proceed.
- Use `read_file` to understand existing code.
- Use `write_file` to create or update files.
- If you need to search, use `grep_search`.
- You must output the code changes via tools. Do not just describe them.
"""

    messages = [SystemMessage(content=system_prompt)]
    
    # CRITICAL: Include history so LLM knows it already executed tools!
    messages.extend(state.get("messages", []))
    
    if review_feedback:
        messages.append(HumanMessage(content=f"Reviewer Feedback on previous attempt: {review_feedback}\nPlease fix these issues."))
    
    # We invoke the LLM. If it decides to call tools, the graph loop should handle it?
    # In LangGraph, usually we have a node that calls the LLM, and if tool calls are present, 
    # we go to a 'tools' node.
    # For this simplified refactor, I will implement a basic tool loop here or rely on LangGraph's prebuilt ToolNode?
    # Let's assume we will wire a ToolNode in the graph.
    
    response = llm_with_tools.invoke(messages)
    
    return {"messages": [response]}
