import os
from enum import Enum
from typing import Any, List, Optional
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field

class SearchAPI(Enum):
    """Enumeration of available search API providers."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    TAVILY = "tavily"
    GITHUB = "github" # Added GitHub
    NONE = "none"

class MCPConfig(BaseModel):
    """Configuration for Model Context Protocol (MCP) servers."""
    url: Optional[str] = Field(default=None)
    tools: Optional[List[str]] = Field(default=None)
    auth_required: Optional[bool] = Field(default=False)

class Configuration(BaseModel):
    """Main configuration class for the Deep Research agent."""
    
    max_structured_output_retries: int = Field(default=3)
    allow_clarification: bool = Field(default=True)
    max_concurrent_research_units: int = Field(default=3) # Reduced from 5 for safety
    search_api: SearchAPI = Field(default=SearchAPI.GITHUB) # Default to GitHub
    max_researcher_iterations: int = Field(default=5)
    max_react_tool_calls: int = Field(default=10)
    
    # Models - defaulting to what we have in src/llm.py (likely GPT-4o or similar)
    summarization_model: str = Field(default="openai:gpt-4.1-mini")
    summarization_model_max_tokens: int = Field(default=8192)
    max_content_length: int = Field(default=50000)
    
    research_model: str = Field(default="openai:gpt-4.1")
    research_model_max_tokens: int = Field(default=10000)
    
    compression_model: str = Field(default="openai:gpt-4.1")
    compression_model_max_tokens: int = Field(default=8192)
    
    final_report_model: str = Field(default="openai:gpt-4.1")
    final_report_model_max_tokens: int = Field(default=10000)
    
    mcp_config: Optional[MCPConfig] = Field(default=None)
    mcp_prompt: Optional[str] = Field(default=None)

    @classmethod
    def from_runnable_config(cls, config: Optional[RunnableConfig] = None) -> "Configuration":
        configurable = config.get("configurable", {}) if config else {}
        values = {
            k: os.environ.get(k.upper(), v)
            for k, v in configurable.items()
        }
        # Filter for known fields
        known_fields = cls.model_fields.keys()
        filtered_values = {k: v for k, v in values.items() if k in known_fields}
        return cls(**filtered_values)
