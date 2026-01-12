from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState
from src.llm import get_llm

def planner_node(state: AgentState):
    """
    Agent responsible for creating a step-by-step plan.
    """
    llm = get_llm()
    user_request = state.get("user_request", "")
    messages = state.get("messages", [])
    
    # If there is already a plan and we are just looping back, maybe we don't need to re-plan?
    # But simpler for now: always refresh plan based on history.
    
    system_prompt = """You are a Senior Technical Lead.
Your goal is to accept a user coding request and break it down into a clear, step-by-step implementation plan.
The plan should be concise and actionable.

Format your response as a numbered list of steps.
Example:
1. Create file src/utils.py with helper functions.
2. Update src/main.py to import the new helpers.
3. Run python src/main.py to verify.

Do not write code, just the plan.
"""

    prompt = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"User Request: {user_request}\n\nContext:\n{messages}")
    ]
    
    response = llm.invoke(prompt)
    
    return {"current_plan": response.content}
