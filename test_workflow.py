#!/usr/bin/env python3
"""
Quick test script to verify the LangGraph workflow is working
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check Azure OpenAI config
if not os.getenv("AZURE_OPENAI_API_KEY") or not os.getenv("AZURE_OPENAI_ENDPOINT"):
    print("❌ Error: Azure OpenAI credentials not found in .env file")
    sys.exit(1)

print("✅ Azure OpenAI credentials found")

# Test graph import
try:
    from graph import app
    print("✅ Graph imported successfully")
except Exception as e:
    print(f"❌ Error importing graph: {e}")
    sys.exit(1)

# Test with sample data
print("\n🧪 Testing workflow with sample data...")
sample_csv = """Segment,Country,Product,Sales,Profit
Government,Canada,Carretera,32370,16185
Government,Germany,Carretera,26420,13210
Midmarket,France,Carretera,32670,10890"""

initial_state = {
    "raw_csv": sample_csv,
    "csv_path": None,
    "schema_info": {},
    "cleaned_df": None,
    "analysis_results": {},
    "insights": ""
}

try:
    result = app.invoke(initial_state)
    print("✅ Workflow executed successfully!")
    print(f"   Rows processed: {result['schema_info'].get('row_count', 0)}")
    print(f"   Total Sales: ${result['analysis_results'].get('total_sales', 0):,.2f}")
    print(f"   Insights generated: {len(result.get('insights', ''))} characters")
    print("\n🎉 All tests passed! The workflow is ready to use.")
except Exception as e:
    print(f"❌ Error running workflow: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

