from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState
from src.llm import get_llm

def reviewer_node(state: AgentState):
    """
    Agent responsible for reviewing the work.
    """
    llm = get_llm()
    current_plan = state.get("current_plan")
    
    # In a real system, the reviewer would read the files changed. 
    # Here we simulate it by asking the LLM to review the conversation/tool outputs?
    # Or better, we give it read_file access too.
    
    system_prompt = f"""You are a Lead Code Reviewer.
Your job is to review the actions taken by the Coder and ensure they match the plan:
{current_plan}

If the code looks correct and the plan is satisfied, respond with "APPROVE".
If there are issues, provide specific feedback on what needs to be fixed.
"""
    
    # Pass the full message history so it sees what the Coder did
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    
    response = llm.invoke(messages)
    
    if "APPROVE" in response.content.upper():
        return {"messages": [response], "review_feedback": None, "is_complete": True}
    else:
        return {"messages": [response], "review_feedback": response.content, "is_complete": False}
