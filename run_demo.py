"""
Interactive demo runner for the LangGraph Financial Data Analysis
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

from graph import app


def load_csv_file(file_path: str) -> str:
    """Load CSV file and return as string"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error loading CSV file: {e}")
        return ""


def main():
    print("\n" + "="*70)
    print("🧾 LangGraph Finance Demo: Agentic Financial Data Cleaner & Analyst")
    print("="*70)
    
    # Check for Azure OpenAI configuration
    if not os.getenv("AZURE_OPENAI_API_KEY") or not os.getenv("AZURE_OPENAI_ENDPOINT"):
        print("\n⚠️  Warning: Azure OpenAI configuration not set in environment.")
        print("   Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT")
        print("   Create a .env file with your Azure OpenAI credentials.")
        print("   You can copy env.example to .env and add your credentials.\n")
        return
    
    # Try to load sample CSV
    csv_file = "sample_financials.csv"
    if os.path.exists(csv_file):
        print(f"\n📥 Loading CSV file: {csv_file}")
        raw_csv = load_csv_file(csv_file)
        
        if not raw_csv:
            print("❌ Failed to load CSV file.")
            return
        
        # Show preview
        df_preview = pd.read_csv(csv_file)
        print(f"   Rows: {len(df_preview)}, Columns: {len(df_preview.columns)}")
        print(f"   Columns: {', '.join(df_preview.columns[:5])}...")
        
    else:
        print(f"\n⚠️  Sample CSV file '{csv_file}' not found.")
        print("   Using built-in sample data...")
        raw_csv = """Segment,Country,Product,Discount Band,Units Sold,Manufacturing Price,Sale Price,Gross Sales,Discounts,Sales,COGS,Profit,Date,Month Number,Month Name,Year
Government,Canada,Carretera,None,1618.5,3,20,32370,0,32370,16185,16185,2014-01-01,1,January,2014
Government,Germany,Carretera,None,1321,3,20,26420,0,26420,13210,13210,2014-01-01,1,January,2014
Midmarket,France,Carretera,None,2178,3,15,32670,0,32670,21780,10890,2014-06-01,6,June,2014"""
    
    # Run the workflow
    print("\n" + "-"*70)
    print("🔄 Running LangGraph workflow...")
    print("   Nodes: Load & Inspect → Clean & Normalize → Analyze → Generate Insights")
    print("-"*70)
    
    initial_state = {
        "raw_csv": raw_csv,
        "csv_path": csv_file if os.path.exists(csv_file) else None,
        "schema_info": {},
        "cleaned_df": None,
        "analysis_results": {},
        "insights": ""
    }
    
    result = app.invoke(initial_state)
    
    # Display results
    print("\n" + "="*70)
    print("📊 PROCESSING RESULTS")
    print("="*70)
    
    # Schema Info
    schema = result.get("schema_info", {})
    if schema:
        print(f"\n📋 Dataset Schema:")
        print(f"   Total Records: {schema.get('row_count', 'N/A')}")
        print(f"   Total Columns: {schema.get('column_count', 'N/A')}")
        print(f"   Column Names: {', '.join(schema.get('columns', [])[:8])}...")
        
        if schema.get('missing_values'):
            missing = {k: v for k, v in schema['missing_values'].items() if v > 0}
            if missing:
                print(f"   Missing Values: {missing}")
    
    # Analysis Results
    analysis = result.get("analysis_results", {})
    if analysis:
        print(f"\n💰 Financial Analysis:")
        
        if analysis.get("total_sales"):
            print(f"   Total Sales: ${analysis['total_sales']:,.2f}")
        
        if analysis.get("total_profit"):
            print(f"   Total Profit: ${analysis['total_profit']:,.2f}")
        
        if analysis.get("profit_margin"):
            print(f"   Profit Margin: {analysis['profit_margin']:.2f}%")
        
        if analysis.get("top_countries_by_sales"):
            print(f"\n   🌍 Top Countries by Sales:")
            for country, sales in list(analysis["top_countries_by_sales"].items())[:5]:
                print(f"      {country}: ${sales:,.2f}")
        
        if analysis.get("top_segments_by_profit"):
            print(f"\n   📊 Top Segments by Profit:")
            for segment, profit in list(analysis["top_segments_by_profit"].items())[:5]:
                print(f"      {segment}: ${profit:,.2f}")
        
        if analysis.get("sales_by_country"):
            print(f"\n   📈 Sales Breakdown by Country:")
            for country, stats in list(analysis["sales_by_country"].items())[:5]:
                total = stats.get('sum', 0)
                avg = stats.get('mean', 0)
                count = stats.get('count', 0)
                print(f"      {country}: ${total:,.2f} total (avg: ${avg:,.2f}, records: {count})")
    
    # AI Insights
    insights = result.get("insights", "")
    if insights:
        print(f"\n💡 AI-Generated Insights:")
        print("-" * 70)
        # Format insights nicely
        lines = insights.split('\n')
        for line in lines:
            if line.strip():
                print(f"   {line}")
        print("-" * 70)
    
    print("\n" + "="*70)
    print("✅ Demo completed successfully!")
    print("="*70 + "\n")
    
    # Save results to file
    output_file = "demo_results.json"
    
    # Convert DataFrame to dict for JSON serialization
    result_serializable = result.copy()
    if result_serializable.get("cleaned_df") is not None:
        result_serializable["cleaned_df"] = result_serializable["cleaned_df"].to_dict(orient="records")
    
    with open(output_file, "w") as f:
        json.dump(result_serializable, f, indent=2, default=str)
    print(f"💾 Full results saved to: {output_file}\n")
    
    # Show cleaned data preview
    if result.get("cleaned_df") is not None and not result["cleaned_df"].empty:
        print("📋 Cleaned Data Preview (first 3 rows):")
        print(result["cleaned_df"].head(3).to_string())
        print()


if __name__ == "__main__":
    main()
