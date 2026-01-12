from langgraph.prebuilt import create_react_agent
from langchain_core.messages import SystemMessage
from src.llm import get_llm
from src.tools.filesystem import list_files, read_file, write_file
from src.tools.search import grep_search
from src.tools.github import read_github_file

# Define tools
tools = [list_files, read_file, write_file, grep_search, read_github_file]

# Get LLM
model = get_llm()

# Define System Prompt
system_prompt = """You are an Advanced Autonomous Coding Agent.
Your goal is to complete the user's coding task end-to-end.

You have access to valid tools:
- `list_files`, `read_file`, `write_file`: Manage local files.
- `grep_search`: Search codebase.
- `read_github_file`: Fetch external code (if user provides repo).

### Operational Protocol (ReAct):
1. **PLAN**: analyze the request and list steps.
2. **EXPLORE**: use `list_files`/`read_file` to understand the codebase.
3. **ACT**: use `write_file` to create/edit code.
4. **VERIFY**: Check your work.
5. **FINISH**: When done, provide a final summary.

CRITICAL:
- Do not ask for clarification unless absolutely blocked. Make reasonable engineering decisions.
- If you run a tool, you MUST see the output. Use it to inform your next step.
"""

# Create the ReAct Graph
# This prebuilt function handles the Supervisor-Tool-Supervisor loop automatically.
app = create_react_agent(model, tools, prompt=system_prompt)

if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    print("Graph compiled successfully (ReAct Mode).")
    print("Running a test task: 'Create a recursive factorial script'...")
    
    # In ReAct, input is just messages
    result = app.invoke({
        "messages": [HumanMessage(content="Create a python script that calculates factorial recursively")]
    })
    
    print("\nExecution finished.")
    if "messages" in result:
        print("\nFinal Response:")
        print(result["messages"][-1].content)
