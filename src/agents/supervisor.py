from src.state import AgentState
from langchain_core.messages import SystemMessage
from src.llm import get_llm

def supervisor_node(state: AgentState):
    """
    Supervisor that decides the next step.
    Simple state machine logic:
    - If no plan, -> Planner
    - If plan, -> Coder
    - If Coder done, -> Reviewer
    - If Reviewer rejects, -> Coder
    - If Reviewer approves, -> End
    """
    
    # We can actually code this logic deterministically instead of using an LLM 
    # to save tokens and latency for this specific linear flow.
    # However, to be "Agentic", we can let the LLM decide if we have multiple workers.
    # For this refactor, let's use a deterministic router for reliability, 
    # but wrap it in a node.
    
    current_plan = state.get("current_plan")
    review_feedback = state.get("review_feedback")
    is_complete = state.get("is_complete")
    
    if is_complete:
        return {"next_agent": "end"}
        
    if not current_plan:
        return {"next_agent": "planner"}
        
    # If we have a plan, check review status
    # This logic assumes the graph will cycle back to supervisor
    
    # Logic:
    # 1. Planner sets plan.
    # 2. Coder executes.
    # 3. Reviewer reviews.
    # 4. If feedback, Coder fixes.
    # 5. If ok, End.
    
    # To distinguish between "Ready to Code" and "Just Coded", we might need more state.
    # Or simpler:
    # Supervisor is the entry point.
    pass 
    
    # Actually, let's make the Supervisor an LLM router for flexibility.
    
    llm = get_llm()
    system_prompt = """You are the Supervisor of a coding team.
Members: Planner, Coder, Reviewer.

Decide who acts next based on the state:
- If 'current_plan' is missing/empty, call Planner.
- If 'current_plan' exists and 'review_feedback' is present, call Coder.
- If 'current_plan' exists and the last message was from Planner, call Coder.
- If the last message was from Coder:
    - If the user request was for a report, analysis, or question, and Coder answered it, respond with FINISH.
    - If the user request was to WRITE code, call Reviewer.
- If the last message was from Reviewer and it says APPROVE, respond with FINISH.
- If the last message was from Reviewer and it requested changes, call Coder.

CRITICAL: Do not ask the user for clarification. Push the agents to complete the task.
Return only the name of the next agent: Planner, Coder, Reviewer, or FINISH.
"""
    # For now, simplistic routing in valid python is better than LLM for this structure
    # but the prompt asked for "as good as cursor solution" which implies intelligence.
    # Let's use the LLM router.
    
    # We need to see the last message to know who just spoke.
    messages = state.get("messages", [])
    last_agent = "user"
    if messages and hasattr(messages[-1], "name"):
         last_agent = messages[-1].name
    
    # Construct a routing prompt
    messages_content = "\n".join([f"{type(m).__name__}: {m.content[:100]}..." for m in messages[-5:]])
    
    user_prompt = f"""
    Current Plan: {current_plan is not None}
    Review Feedback: {review_feedback if review_feedback else 'None'}
    Recent History:
    {messages_content}
    
    Who's next?
    """
    
    response = llm.invoke([SystemMessage(content=system_prompt), user_prompt])
    decision = response.content.strip().upper()
    
    if "PLANNER" in decision:
        return {"next_agent": "planner"}
    elif "CODER" in decision:
        return {"next_agent": "coder"}
    elif "REVIEWER" in decision:
        return {"next_agent": "reviewer"}
    elif "FINISH" in decision:
        return {"next_agent": "end"}
    else:
        # Fallback
        return {"next_agent": "planner"}
