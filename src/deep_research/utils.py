import asyncio
import logging
import os
from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    MessageLikeRepresentation,
    filter_messages,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool, BaseTool
from langchain_core.language_models import BaseChatModel

# Import local tools and LLM
from src.tools.github import read_github_file, search_github_code, list_github_files
from src.llm import get_llm
from src.deep_research.configuration import Configuration, SearchAPI
from src.deep_research.state import ResearchComplete, Summary
from src.deep_research.prompts import summarize_webpage_prompt

##########################
# GitHub Search Tool Utils
##########################

@tool
def github_search_tool(query: str, owner: str = "langchain-ai", repo: str = "langgraph") -> str:
    """Search for code in a GitHub repository."""
    # Note: Defaults are placeholders, the LLM should provide them or we inject them from config
    return search_github_code(query, owner, repo)

@tool
def github_list_files_tool(owner: str, repo: str, path: str = "") -> str:
    """List files in a GitHub repository directory."""
    return list_github_files(owner, repo, path)

@tool
def github_read_file_tool(owner: str, repo: str, path: str) -> str:
    """Read a file from a GitHub repository."""
    return read_github_file(owner, repo, path)

# We can also wrap local filesystem tools if we want "Deep Research" on local code
from src.tools.search import grep_search
from src.tools.filesystem import list_files, read_file

@tool
def local_grep_tool(query: str, path: str = ".") -> str:
    """Search for code in the local filesystem using grep."""
    return grep_search(query, path)

@tool
def local_list_files_tool(path: str = ".") -> str:
    """List files in the local filesystem."""
    try:
        return "\n".join(list_files(path))
    except Exception as e:
        return str(e)

@tool
def local_read_file_tool(path: str) -> str:
    """Read a file from the local filesystem."""
    return read_file(path)


##########################
# Reflection Tool Utils
##########################

@tool(description="Strategic reflection tool for research planning")
def think_tool(reflection: str) -> str:
    """Tool for strategic reflection on research progress and decision-making."""
    return f"Reflection recorded: {reflection}"

##########################
# Tool Utils
##########################

async def get_all_tools(config: RunnableConfig) -> List[BaseTool]:
    """Assemble complete toolkit including research and code tools."""
    # Start with core research tools
    tools = [think_tool, tool(ResearchComplete)]
    
    # Add GitHub/Code tools
    # We add both GitHub and Local tools for maximum flexibility, 
    # or control via config.
    
    # For this implementation, we include specific GitHub tools 
    # The agent should know the repo it's researching.
    # Ideally, we inject the repo/owner from the user request or config?
    # For now, we give the tools that take owner/repo as args.
    
    tools.extend([
        github_search_tool,
        github_list_files_tool,
        github_read_file_tool,
        local_grep_tool,
        local_list_files_tool,
        local_read_file_tool
    ])
    
    return tools

def get_notes_from_tool_calls(messages: list[MessageLikeRepresentation]):
    """Extract notes from tool call messages."""
    return [tool_msg.content for tool_msg in filter_messages(messages, include_types="tool")]

##########################
# LLM Utils
##########################

def get_configurable_llm(config: RunnableConfig = None):
    """Get the LLM instance, optionally configured."""
    # Reusing the existing src.llm.get_llm which returns AzureChatOpenAI
    # We ignore the specific model names in Configuration (e.g. "openai:gpt-4") 
    # and just use the one configured in src/llm.py for simplicity, 
    # unless we want to map them.
    return get_llm()

def get_api_key_for_model(model_name: str, config: RunnableConfig):
    # Placeholder as we use Azure Auth
    return "azure-key"

##########################
# Misc Utils
##########################

def get_today_str() -> str:
    """Get current date formatted."""
    now = datetime.now()
    return f"{now:%a} {now:%b} {now.day}, {now:%Y}"

def is_token_limit_exceeded(exception: Exception, model_name: str = None) -> bool:
    """Determine if an exception indicates a token/context limit was exceeded."""
    error_str = str(exception).lower()
    return "context length" in error_str or "token limit" in error_str

def remove_up_to_last_ai_message(messages: list[MessageLikeRepresentation]) -> list[MessageLikeRepresentation]:
    """Truncate message history."""
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], AIMessage):
            return messages[:i]
    return messages
