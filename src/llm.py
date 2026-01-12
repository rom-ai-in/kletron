import os
from dotenv import load_dotenv

try:
    from langchain_openai import AzureChatOpenAI
except ImportError:
    from langchain_openai import ChatOpenAI as AzureChatOpenAI

load_dotenv()

def get_llm():
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o") # Defaulting to newer model if available
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    
    return AzureChatOpenAI(
        azure_endpoint=azure_endpoint,
        azure_deployment=azure_deployment,
        openai_api_version=api_version,
        openai_api_key=api_key,
        # Model 'gpt-5-mini' requires temperature=1 explicitly or implicitly.
        # Since removing it didn't work (maybe library defaults to 0?), we set it to 1.
        temperature=1,
    )
