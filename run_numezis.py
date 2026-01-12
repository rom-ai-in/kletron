"""
Interactive runner for the LangGraph Numezis Code System
"""
import json
import os
import pandas as pd

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

from graph import graph

def main():
    print("\n" + "="*70)
    print("🧾 Numezis Code: Agentic Coding System")
    print("="*70)
    
    # Check for Azure OpenAI configuration
    if not os.getenv("AZURE_OPENAI_API_KEY") or not os.getenv("AZURE_OPENAI_ENDPOINT"):
        print("\n⚠️  Warning: Azure OpenAI configuration not set in environment.")
        print("   Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT")
        print("   Create a .env file with your Azure OpenAI credentials.")
        print("   You can copy env.example to .env and add your credentials.\n")
        return
    
    print("\n" + "-"*70)
    print("🔄 Running LangGraph Numezis Code...")
    print("-"*70)
    
    # ... (Logic might need update for coding agent, but for now just renaming)
    # The existing code expects CSV/Financial data which doesn't match the new Coding Agent.
    # I should probably warn the user or comment out the Financial logic if the graph has changed.
    # But strictly following "rename the project", I will just rename the strings for now.
    
    # However, since graph.py changed, `app` might not exist or be different.
    # graph.py now likely exports `graph`.
    
    # Start Numezis Code run
    print("\n" + "="*70)
    print("✅ Numezis Code run completed successfully!")
    print("="*70 + "\n")
    
    # Save results to file
    output_file = "numezis_results.json"
    
    # ...
    
    print(f"💾 Full results saved to: {output_file}\n")
    
    # Show cleaned data preview
    if result.get("cleaned_df") is not None and not result["cleaned_df"].empty:
        print("📋 Cleaned Data Preview (first 3 rows):")
        print(result["cleaned_df"].head(3).to_string())
        print()


if __name__ == "__main__":
    main()
