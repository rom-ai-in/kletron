"""
LangGraph Finance Demo: Multi-Agent Financial Analysis System

This workflow demonstrates a sophisticated multi-agent finance system that:
1. Validates data quality
2. Loads and inspects raw financial CSV data
3. Cleans and normalizes the data
4. Analyzes and computes KPIs
5. Generates visualizations (charts)
6. Detects anomalies
7. Forecasts trends
8. Assesses risks
9. Generates reports
10. Provides interactive chat
"""

try:
    from langchain_openai import AzureChatOpenAI
except ImportError:
    from langchain_openai import ChatOpenAI as AzureChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Dict, Any, Optional, Annotated, List
from typing_extensions import TypedDict as ExtTypedDict
import pandas as pd
import json
import os
import io
import re
from datetime import datetime
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

# Visualization imports
try:
    import plotly.graph_objects as go
    import plotly.express as px
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False

# Statistical imports
try:
    import numpy as np
    from scipy import stats
    STATS_AVAILABLE = True
except ImportError:
    STATS_AVAILABLE = False

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


class FinanceState(ExtTypedDict):
    """State schema for the multi-agent financial data analysis workflow"""
    messages: Annotated[list[BaseMessage], add_messages]  # Chat messages
    raw_csv: str  # Raw CSV content as string
    csv_path: Optional[str]  # Optional file path
    schema_info: Dict[str, Any]  # Column info and data types
    cleaned_df: Optional[pd.DataFrame]  # Cleaned DataFrame
    analysis_results: Dict[str, Any]  # KPI calculations and aggregations
    insights: str  # AI-generated insights summary
    data_quality_report: Dict[str, Any]  # Data quality validation results
    charts: Dict[str, str]  # Generated charts (HTML/JSON)
    forecasts: Dict[str, Any]  # Forecasting results
    anomalies: List[Dict[str, Any]]  # Detected anomalies
    risk_report: Dict[str, Any]  # Risk analysis results
    generated_report: Optional[str]  # Generated report content
    user_intent: Optional[str]  # Supervisor agent's intent classification
    next_action: Optional[str]  # Supervisor's decision on which agent to call next


# Initialize LLM with Azure OpenAI configuration
# Use AzureChatOpenAI for proper Azure OpenAI support
azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")
api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

llm = AzureChatOpenAI(
    azure_endpoint=azure_endpoint,
    azure_deployment=azure_deployment,
    openai_api_version=api_version,
    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    max_tokens=int(os.getenv("AZURE_OPENAI_MAX_TOKENS", "4096")),
    # Note: This model only supports default temperature (1.0)
)


def supervisor_agent(state: FinanceState) -> Dict:
    """
    Supervisor Agent: Central orchestrator that decides which agent to invoke next OR handles chat directly.
    Analyzes current state and user intent to either route to an agent or respond directly.
    
    IMPORTANT: All analysis agents (forecasting, visualization, risk analysis, report generator, etc.)
    require processed data. The supervisor ensures data processing happens first.
    """
    messages = state.get("messages", [])
    raw_csv = state.get("raw_csv", "")
    csv_path = state.get("csv_path")
    analysis_results = state.get("analysis_results", {})
    cleaned_df = state.get("cleaned_df")
    data_quality_report = state.get("data_quality_report", {})
    schema_info = state.get("schema_info", {})
    insights = state.get("insights", "")
    charts = state.get("charts", {})
    forecasts = state.get("forecasts", {})
    anomalies = state.get("anomalies", [])
    risk_report = state.get("risk_report", {})
    generated_report = state.get("generated_report")
    
    # Track what's been done
    next_action = None
    
    # Helper: Check if data processing is complete
    has_cleaned_df = cleaned_df is not None and (not hasattr(cleaned_df, 'empty') or not cleaned_df.empty)
    has_processed_data = has_cleaned_df and analysis_results and not analysis_results.get("error")
    
    # Helper: Check if data processing is needed
    needs_data_processing = not has_processed_data and (
        raw_csv or 
        csv_path or 
        os.path.exists("/Users/romainmagnin/Desktop/demo/Financials.csv")
    )
    
    # PRIORITY 1: Handle user messages FIRST (before auto-processing)
    # This prevents auto-running insights/analysis for simple greetings
    if messages:
        # Get the last HUMAN message (not AI response)
        last_human_message = None
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                last_human_message = msg
                break
        
        if last_human_message:
            user_query = last_human_message.content.lower().strip()
            
            # Check for specific agent requests
            # IMPORTANT: All analysis agents require processed data - ensure data processing subgraph runs first
            
            # 1. Visualization Agent - comprehensive keyword detection
            visualization_keywords = [
                "chart", "charts", "visualize", "visualization", "graph", "graphs", "plot", "plots",
                "bar chart", "pie chart", "line chart", "heatmap", "dashboard", "visual", "diagram"
            ]
            if any(kw in user_query for kw in visualization_keywords) and not charts:
                # Visualization requires processed data
                if has_processed_data:
                    next_action = "visualization"
                elif needs_data_processing:
                    # Route to data processing subgraph first, then visualization will happen after
                    if not data_quality_report or data_quality_report.get("error"):
                        next_action = "data_quality"
                    else:
                        next_action = "data_processing"
                else:
                    # No CSV available - supervisor responds that data is needed
                    return _supervisor_handle_chat(state, last_human_message.content)
            
            # 2. Forecasting Agent - comprehensive keyword detection
            elif any(kw in user_query for kw in [
                "forecast", "forecasts", "predict", "prediction", "future", "projection", "trend",
                "12-month", "12 month", "monthly forecast", "quarterly forecast", "sales forecast",
                "profit forecast", "revenue forecast"
            ]):
                # Forecasting requires processed data
                # Check if forecasts already exist
                if forecasts and forecasts.get("next_quarter"):
                    # Forecasts already exist - use chat to answer question about them
                    return _supervisor_handle_chat(state, last_human_message.content)
                elif has_processed_data:
                    # Data is processed, generate forecasts via forecasting agent
                    next_action = "forecasting"
                elif needs_data_processing:
                    # Need to process data first via subgraph
                    if not data_quality_report or data_quality_report.get("error"):
                        next_action = "data_quality"
                    else:
                        next_action = "data_processing"
                else:
                    # No CSV available - respond via chat
                    return _supervisor_handle_chat(state, last_human_message.content)
            
            # 3. Anomaly Detection Agent - comprehensive keyword detection
            elif any(kw in user_query for kw in [
                "anomaly", "anomalies", "outlier", "outliers", "unusual", "issue", "issues",
                "detect anomalies", "find outliers", "suspicious", "irregular", "abnormal",
                "unexpected", "strange"
            ]) and not anomalies:
                # Anomaly detection requires cleaned data (at minimum)
                if has_cleaned_df:
                    next_action = "anomaly_detection"
                elif needs_data_processing:
                    # Route to data processing subgraph first
                    if not data_quality_report or data_quality_report.get("error"):
                        next_action = "data_quality"
                    else:
                        next_action = "data_processing"
                else:
                    return _supervisor_handle_chat(state, last_human_message.content)
            
            # 4. Risk Analysis Agent - comprehensive keyword detection
            elif any(kw in user_query for kw in [
                "risk", "risks", "danger", "problem", "problems", "risk assessment", "risk analysis",
                "concentration risk", "financial risk", "vulnerability", "vulnerabilities",
                "threat", "threats", "concern", "concerns"
            ]) and not risk_report:
                # Risk analysis requires processed data
                if has_processed_data:
                    next_action = "risk_analysis"
                elif needs_data_processing:
                    # Route to data processing subgraph first
                    if not data_quality_report or data_quality_report.get("error"):
                        next_action = "data_quality"
                    else:
                        next_action = "data_processing"
                else:
                    return _supervisor_handle_chat(state, last_human_message.content)
            
            # 5. Report Generator Agent - comprehensive keyword detection
            elif any(kw in user_query for kw in [
                "report", "reports", "summary", "summaries", "document", "executive report",
                "generate report", "create report", "financial report", "analysis report",
                "comprehensive report", "full report"
            ]) and not generated_report:
                # Report generator requires analysis results
                if analysis_results and not analysis_results.get("error"):
                    next_action = "report_generator"
                elif needs_data_processing:
                    # Route to data processing subgraph first
                    if not data_quality_report or data_quality_report.get("error"):
                        next_action = "data_quality"
                    else:
                        next_action = "data_processing"
                else:
                    return _supervisor_handle_chat(state, last_human_message.content)
            # Simple greetings - supervisor handles directly (exact matches only)
            # Note: Conversational questions like "how are you?" should go to chat handler
            elif user_query in ["hi", "hello", "hey"] or user_query.startswith("hi ") or user_query.startswith("hello ") or user_query == "help" or user_query == "?":
                # Supervisor handles simple greetings directly - no routing needed
                greeting_responses = {
                    "hi": "Hello! I'm your financial analysis assistant. I can help you analyze financial data, answer questions about sales and profits, generate reports, and create visualizations. How can I help you today?",
                    "hello": "Hello! I'm ready to help with financial analysis. You can ask me to analyze CSV data, answer questions about financial metrics, or generate reports. What would you like to do?",
                    "hey": "Hey! I'm your financial analysis assistant. How can I help you with financial data analysis today?",
                    "help": "I can help you with:\n- Analyzing financial CSV data\n- Answering questions about sales, profits, and trends\n- Generating visualizations and charts\n- Forecasting future trends\n- Detecting anomalies\n- Assessing risks\n- Creating executive reports\n\nJust ask me a question or provide CSV data to get started!",
                    "what can you do": "I'm a multi-agent financial analysis system. I can:\n1. Validate and clean financial data\n2. Analyze KPIs (sales, profit, margins)\n3. Generate interactive charts\n4. Forecast trends\n5. Detect anomalies\n6. Assess risks\n7. Create executive reports\n8. Answer questions about your data\n\nWould you like me to analyze some financial data?"
                }
                
                response_text = greeting_responses.get(user_query, "Hello! I'm your financial analysis assistant. I can analyze CSV data, answer questions about financial metrics, generate reports, and create visualizations. How can I help you today?")
                ai_message = AIMessage(content=response_text)
                return {
                    "messages": [ai_message],
                    "user_intent": "greeting",
                    "next_action": "__end__"  # End after greeting response
                }
            # Data query - supervisor handles if data exists, otherwise route to data processing subgraph
            # Check for data analysis queries (breakdown, analysis, comparison, etc.)
            data_analysis_keywords = [
                "breakdown", "break down", "by", "group by", "aggregate", "sum", "total",
                "what", "show", "tell", "how much", "which", "compare", "comparison",
                "sales by", "profit by", "revenue by", "margin by", "segment by", "country by",
                "product by", "discount", "band", "×", "x", "cross", "pivot", "table"
            ]
            if any(kw in user_query for kw in data_analysis_keywords):
                # This is a data analysis query - needs processed data
                if has_processed_data:
                    # Data is processed - supervisor handles chat directly with DataFrame query capability
                    return _supervisor_handle_chat(state, last_human_message.content)
                elif needs_data_processing:
                    # Need to process data first via subgraph
                    if not data_quality_report or data_quality_report.get("error"):
                        next_action = "data_quality"
                    else:
                        next_action = "data_processing"
                else:
                    # No CSV available - respond via chat
                    return _supervisor_handle_chat(state, last_human_message.content)
            else:
                # General chat - check if it's a data question that needs processing
                # If query mentions financial terms, it might need data
                financial_terms = ["sales", "profit", "revenue", "margin", "cogs", "discount", "segment", "country", "product"]
                if any(term in user_query for term in financial_terms):
                    # Likely a financial data question - ensure data is processed
                    if has_processed_data:
                        # Data available - handle via chat
                        return _supervisor_handle_chat(state, last_human_message.content)
                    elif needs_data_processing:
                        # Need to process data first via subgraph
                        if not data_quality_report or data_quality_report.get("error"):
                            next_action = "data_quality"
                        else:
                            next_action = "data_processing"
                    else:
                        # No CSV - respond via chat
                        return _supervisor_handle_chat(state, last_human_message.content)
                else:
                    # General chat - supervisor handles directly
                    return _supervisor_handle_chat(state, last_human_message.content)
    
    # PRIORITY 2: Auto-processing (only if no user messages or user requested analysis)
    # Step 1: Check if CSV needs to be loaded/processed
    elif needs_data_processing:
        if not data_quality_report or data_quality_report.get("error"):
            next_action = "data_quality"
        else:
            # Use data processing subgraph (load → clean → analyze)
            next_action = "data_processing"
    
    # Step 2: Check if analysis is needed (fallback - shouldn't happen if subgraph works correctly)
    elif has_cleaned_df and not analysis_results:
        # Fallback: use subgraph to complete analysis
        next_action = "data_processing"
    
    # Step 3: Check if insights are needed (only if no user messages)
    elif analysis_results and not insights:
        # Only auto-generate insights if there are no user messages waiting
        # (user messages are handled above)
        next_action = "insights"
    
    else:
        # Default: no action needed, end
        next_action = "__end__"
    
    # If we have a next_action that's not END, route to that agent
    if next_action and next_action != "__end__":
        return {
            "user_intent": next_action,
            "next_action": next_action
        }
    
    # Otherwise, end
    return {
        "user_intent": "complete",
        "next_action": "__end__"
    }


def _supervisor_handle_chat(state: FinanceState, user_query: str) -> Dict:
    """
    Helper function for supervisor to handle chat responses directly.
    Queries data and generates LLM response.
    """
    analysis_results = state.get("analysis_results", {})
    insights = state.get("insights", "")
    schema_info = state.get("schema_info", {})
    df = state.get("cleaned_df")
    
    # Try to query the DataFrame first for specific questions
    query_result = None
    if df is not None and (not hasattr(df, 'empty') or not df.empty):
        query_result = query_dataframe(df, user_query)
    
    # Build context from available data
    context = "You are a financial analyst assistant with access to financial data. "
    
    # Add DataFrame query results if available
    if query_result and "Error" not in query_result:
        context += f"\n**Actual Data Query Results:**\n{query_result}\n\n"
    
    if analysis_results:
        context += f"""
Available Financial Analysis Summary:
- Total Sales: ${analysis_results.get('total_sales', 0):,.2f}
- Total Profit: ${analysis_results.get('total_profit', 0):,.2f}
- Profit Margin: {analysis_results.get('profit_margin', 0):.2f}%
- Total Records: {analysis_results.get('total_records', 0)}

Top Countries by Sales:
"""
        if analysis_results.get("top_countries_by_sales"):
            for country, sales in list(analysis_results["top_countries_by_sales"].items())[:5]:
                context += f"  - {country}: ${sales:,.2f}\n"
        
        context += "\nTop Segments by Profit:\n"
        if analysis_results.get("top_segments_by_profit"):
            for segment, profit in list(analysis_results["top_segments_by_profit"].items())[:5]:
                context += f"  - {segment}: ${profit:,.2f}\n"
    
    if insights:
        context += f"\nPrevious Insights:\n{insights}\n"
    
    if schema_info:
        context += f"\nDataset has {schema_info.get('row_count', 0)} rows and {schema_info.get('column_count', 0)} columns.\n"
        context += f"Available columns: {', '.join(schema_info.get('columns', []))}\n"
    
    # Create prompt for the LLM
    if query_result and "Error" not in query_result and "Query executed" not in query_result:
        # We have actual data - prioritize it
        prompt = f"""You are a financial analyst assistant with access to actual financial data.

**ACTUAL DATA QUERY RESULTS:**
{query_result}

User Question: {user_query}

**CRITICAL**: The query results above contain EXACT numbers from the dataset. Use these exact numbers in your answer. 
Do NOT estimate, calculate, or guess - use the precise values shown above.

Provide a clear, professional answer using the exact numbers from the query results. Be precise and actionable."""
    else:
        # No specific query match - use summary data
        prompt = f"""{context}

User Question: {user_query}

Provide a helpful, professional answer about the financial data. Be precise, use actual numbers from the data, and be actionable."""
    
    try:
        response = llm.invoke(prompt)
        ai_message = AIMessage(content=response.content)
        
        return {
            "messages": [ai_message],
            "user_intent": "chat",
            "next_action": "__end__"  # End after chat response
        }
    
    except Exception as e:
        error_message = AIMessage(content=f"I apologize, but I encountered an error: {str(e)}")
        return {
            "messages": [error_message],
            "user_intent": "chat",
            "next_action": "__end__"
        }


def data_quality_agent(state: FinanceState) -> Dict:
    """
    Agent 1: Data Quality Agent
    Validates data quality before processing - checks for missing values, outliers, duplicates, etc.
    """
    raw_csv = state.get("raw_csv", "")
    csv_path = state.get("csv_path")
    
    # Default CSV path (hardcoded for demo)
    DEFAULT_CSV_PATH = "/Users/romainmagnin/Desktop/demo/Financials.csv"
    
    # If no CSV provided, use default path
    if not csv_path and not raw_csv:
        csv_path = DEFAULT_CSV_PATH
    
    try:
        # Load CSV for quality check
        if csv_path and os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
        elif raw_csv:
            df = pd.read_csv(io.StringIO(raw_csv))
        else:
            return {
                "data_quality_report": {"error": "No CSV data available for quality check"}
            }
        
        quality_report = {
            "timestamp": datetime.now().isoformat(),
            "total_records": len(df),
            "total_columns": len(df.columns),
            "checks": {}
        }
        
        # Check 1: Missing values
        missing_values = df.isnull().sum().to_dict()
        missing_count = sum(missing_values.values())
        quality_report["checks"]["missing_values"] = {
            "status": "pass" if missing_count == 0 else "warning",
            "missing_count": missing_count,
            "missing_by_column": {k: v for k, v in missing_values.items() if v > 0}
        }
        
        # Check 2: Duplicates
        duplicate_count = df.duplicated().sum()
        quality_report["checks"]["duplicates"] = {
            "status": "pass" if duplicate_count == 0 else "warning",
            "duplicate_count": int(duplicate_count)
        }
        
        # Check 3: Data types consistency
        type_issues = []
        for col in df.columns:
            if df[col].dtype == 'object':
                # Check if numeric-looking columns are strings
                numeric_series = pd.to_numeric(df[col], errors='coerce')
                if numeric_series.notna().sum() / len(df) > 0.5:
                    type_issues.append(f"{col} appears numeric but stored as text")
        
        quality_report["checks"]["data_types"] = {
            "status": "pass" if len(type_issues) == 0 else "warning",
            "issues": type_issues
        }
        
        # Check 4: Outliers (for numeric columns)
        outliers = {}
        numeric_cols = df.select_dtypes(include=['number']).columns
        if STATS_AVAILABLE and len(numeric_cols) > 0:
            for col in numeric_cols[:5]:  # Check first 5 numeric columns
                if len(df[col].dropna()) > 10:
                    z_scores = np.abs(stats.zscore(df[col].dropna()))
                    outlier_count = (z_scores > 3).sum()
                    if outlier_count > 0:
                        outliers[col] = int(outlier_count)
        
        quality_report["checks"]["outliers"] = {
            "status": "pass" if len(outliers) == 0 else "info",
            "outlier_counts": outliers
        }
        
        # Overall quality score
        warnings = sum(1 for check in quality_report["checks"].values() if check["status"] == "warning")
        quality_report["quality_score"] = "excellent" if warnings == 0 else "good" if warnings <= 2 else "needs_review"
        quality_report["summary"] = f"Data quality check completed: {quality_report['quality_score']} ({warnings} warnings)"
        
        return {"data_quality_report": quality_report}
    
    except Exception as e:
        return {
            "data_quality_report": {"error": f"Data quality check failed: {str(e)}"}
        }


def load_and_inspect_csv(state: FinanceState) -> Dict:
    """
    Node 1: Load CSV data and inspect schema.
    Handles both file paths and raw CSV strings.
    Uses default CSV path if none provided.
    """
    raw_csv = state.get("raw_csv", "")
    csv_path = state.get("csv_path")
    
    # Default CSV path (hardcoded for demo)
    DEFAULT_CSV_PATH = "/Users/romainmagnin/Desktop/demo/Financials.csv"
    
    # If no CSV provided, use default path
    if not csv_path and not raw_csv:
        csv_path = DEFAULT_CSV_PATH
    
    try:
        # Load CSV from file path or string
        if csv_path and os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
        elif raw_csv:
            df = pd.read_csv(io.StringIO(raw_csv))
        else:
            return {
                "schema_info": {"error": f"No CSV data provided and default path not found: {DEFAULT_CSV_PATH}"},
                "cleaned_df": None
            }
        
        # Extract schema information
        schema_info = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "sample_data": df.head(5).to_dict(orient="records"),
            "missing_values": df.isnull().sum().to_dict(),
            "numeric_columns": df.select_dtypes(include=['number']).columns.tolist(),
            "text_columns": df.select_dtypes(include=['object']).columns.tolist()
        }
        
        return {
            "schema_info": schema_info,
            "cleaned_df": df  # Pass through for cleaning
        }
    
    except Exception as e:
        return {
            "schema_info": {"error": f"Failed to load CSV: {str(e)}"},
            "cleaned_df": None
        }


def clean_and_normalize(state: FinanceState) -> Dict:
    """
    Node 2: Clean and normalize financial data.
    Removes currency symbols, commas, handles missing values, converts datatypes.
    """
    df = state.get("cleaned_df")
    
    if df is None or df.empty:
        return {"cleaned_df": None}
    
    try:
        df_cleaned = df.copy()
        
        # Clean text columns that might contain numeric data with formatting
        for col in df_cleaned.columns:
            if df_cleaned[col].dtype == 'object':
                # Remove common formatting characters
                df_cleaned[col] = df_cleaned[col].astype(str).apply(
                    lambda x: re.sub(r'[\$,\-–—]', '', str(x)) if pd.notna(x) and x != 'nan' else x
                )
                # Remove leading/trailing whitespace
                df_cleaned[col] = df_cleaned[col].str.strip()
                # Replace empty strings with NaN
                df_cleaned[col] = df_cleaned[col].replace(['', 'nan', 'None'], pd.NA)
        
        # Try to convert numeric-looking columns to numeric
        for col in df_cleaned.columns:
            if df_cleaned[col].dtype == 'object':
                # Try converting to numeric
                numeric_series = pd.to_numeric(df_cleaned[col], errors='coerce')
                # If more than 50% converted successfully, use numeric
                if numeric_series.notna().sum() / len(df_cleaned) > 0.5:
                    df_cleaned[col] = numeric_series
        
        # Handle missing values in numeric columns (fill with 0 or median)
        numeric_cols = df_cleaned.select_dtypes(include=['number']).columns
        for col in numeric_cols:
            if df_cleaned[col].isnull().any():
                # Fill with median for numeric columns
                df_cleaned[col] = df_cleaned[col].fillna(df_cleaned[col].median())
        
        # Handle missing values in text columns (fill with "Unknown")
        text_cols = df_cleaned.select_dtypes(include=['object']).columns
        for col in text_cols:
            if df_cleaned[col].isnull().any():
                df_cleaned[col] = df_cleaned[col].fillna("Unknown")
        
        return {"cleaned_df": df_cleaned}
    
    except Exception as e:
        return {
            "cleaned_df": state.get("cleaned_df"),  # Return original on error
            "schema_info": {**state.get("schema_info", {}), "clean_error": str(e)}
        }


def analyze_and_summarize(state: FinanceState) -> Dict:
    """
    Node 3: Analyze cleaned data and compute KPIs.
    Calculates sales by country, profit by segment, averages, etc.
    """
    df = state.get("cleaned_df")
    
    if df is None or df.empty:
        return {"analysis_results": {}}
    
    try:
        analysis_results = {
            "timestamp": datetime.now().isoformat(),
            "total_records": len(df),
            "summary_stats": {}
        }
        
        # Identify key columns (common financial dataset columns)
        columns_lower = [col.lower() for col in df.columns]
        
        # Find sales/profit columns
        sales_col = None
        profit_col = None
        country_col = None
        segment_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'sales' in col_lower or 'revenue' in col_lower:
                sales_col = col
            if 'profit' in col_lower:
                profit_col = col
            if 'country' in col_lower:
                country_col = col
            if 'segment' in col_lower or 'category' in col_lower:
                segment_col = col
        
        # Basic statistics
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            analysis_results["summary_stats"] = df[numeric_cols].describe().to_dict()
        
        # Sales by country (if country column exists)
        if country_col and sales_col:
            sales_by_country = df.groupby(country_col)[sales_col].agg(['sum', 'mean', 'count']).sort_values('sum', ascending=False)
            analysis_results["sales_by_country"] = sales_by_country.to_dict(orient="index")
        
        # Profit by segment (if segment column exists)
        if segment_col and profit_col:
            profit_by_segment = df.groupby(segment_col)[profit_col].agg(['sum', 'mean', 'count']).sort_values('sum', ascending=False)
            analysis_results["profit_by_segment"] = profit_by_segment.to_dict(orient="index")
        
        # Overall totals
        if sales_col:
            analysis_results["total_sales"] = float(df[sales_col].sum())
            analysis_results["average_sales"] = float(df[sales_col].mean())
        
        if profit_col:
            analysis_results["total_profit"] = float(df[profit_col].sum())
            analysis_results["average_profit"] = float(df[profit_col].mean())
            if sales_col:
                analysis_results["profit_margin"] = float((df[profit_col].sum() / df[sales_col].sum()) * 100)
        
        # Top performers
        if sales_col and country_col:
            top_countries = df.groupby(country_col)[sales_col].sum().nlargest(5).to_dict()
            analysis_results["top_countries_by_sales"] = top_countries
        
        if profit_col and segment_col:
            top_segments = df.groupby(segment_col)[profit_col].sum().nlargest(5).to_dict()
            analysis_results["top_segments_by_profit"] = top_segments
        
        return {"analysis_results": analysis_results}
    
    except Exception as e:
        return {
            "analysis_results": {
                "error": f"Analysis failed: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
        }


def query_dataframe(df: pd.DataFrame, query: str) -> str:
    """
    Helper function to query the DataFrame based on natural language query.
    Returns filtered data or summary statistics with actual numbers from the data.
    """
    try:
        # Normalize column names (remove extra spaces)
        df.columns = df.columns.str.strip()
        
        # Work with a copy to avoid modifying original
        df_work = df.copy()
        
        # Normalize string columns for filtering
        for col in df_work.select_dtypes(include=['object']).columns:
            df_work[col] = df_work[col].astype(str).str.strip()
        
        query_lower = query.lower()
        
        # Extract segment and country from query
        segments = ['government', 'midmarket', 'enterprise', 'small business', 'channel partners']
        countries = ['france', 'germany', 'canada', 'mexico', 'united states']
        
        segment_match = None
        country_match = None
        
        for seg in segments:
            if seg in query_lower:
                segment_match = seg
                break
        
        for country in countries:
            if country in query_lower or (country == 'united states' and ('usa' in query_lower or 'united states' in query_lower)):
                country_match = country
                break
        
        # Build filter conditions
        filters = []
        
        if segment_match:
            # Match segment (case-insensitive, handle variations)
            segment_col = None
            for col in df_work.columns:
                if 'segment' in col.lower():
                    segment_col = col
                    break
            
            if segment_col:
                # Handle "Small Business" vs "SmallBusiness" etc - normalize both sides
                df_segments = df_work[segment_col].astype(str).str.lower().str.strip().str.replace(' ', '').str.replace('-', '')
                match_seg = segment_match.replace(' ', '').replace('-', '')
                segment_mask = df_segments == match_seg
                filters.append(segment_mask)
        
        if country_match:
            country_col = None
            for col in df_work.columns:
                if 'country' in col.lower():
                    country_col = col
                    break
            
            if country_col:
                if country_match == 'united states':
                    country_mask = df_work[country_col].astype(str).str.lower().str.contains('united states|usa', case=False, na=False, regex=True)
                else:
                    country_mask = df_work[country_col].astype(str).str.lower().str.contains(country_match, case=False, na=False)
                filters.append(country_mask)
        
        # Apply filters
        if filters:
            # Combine all filters with AND logic
            combined_filter = filters[0]
            for f in filters[1:]:
                combined_filter = combined_filter & f
            filtered = df_work[combined_filter].copy()
            
            if not filtered.empty:
                # Calculate metrics
                sales_col = None
                profit_col = None
                
                for col in filtered.columns:
                    col_lower = col.lower()
                    if 'sales' in col_lower and sales_col is None:
                        sales_col = col
                    if 'profit' in col_lower and profit_col is None:
                        profit_col = col
                
                result_parts = []
                
                if segment_match and country_match:
                    result_parts.append(f"{segment_match.title()} segment in {country_match.title()}:")
                elif segment_match:
                    result_parts.append(f"{segment_match.title()} segment:")
                elif country_match:
                    result_parts.append(f"{country_match.title()}:")
                
                result_parts.append(f"  Records: {len(filtered)}")
                
                if sales_col and sales_col in filtered.columns:
                    total_sales = float(filtered[sales_col].sum())
                    avg_sales = float(filtered[sales_col].mean())
                    result_parts.append(f"  Total Sales: ${total_sales:,.2f}")
                    result_parts.append(f"  Average Sales: ${avg_sales:,.2f}")
                
                if profit_col and profit_col in filtered.columns:
                    total_profit = float(filtered[profit_col].sum())
                    avg_profit = float(filtered[profit_col].mean())
                    result_parts.append(f"  Total Profit: ${total_profit:,.2f}")
                    result_parts.append(f"  Average Profit: ${avg_profit:,.2f}")
                    
                    if sales_col and total_sales > 0:
                        margin = (total_profit / total_sales) * 100
                        result_parts.append(f"  Profit Margin: {margin:.2f}%")
                
                return "\n".join(result_parts)
        
        # Monthly/time series queries
        if any(word in query_lower for word in ['month', 'monthly', 'time', 'series', 'trend', 'chart']):
            month_col = None
            year_col = None
            
            for col in df.columns:
                col_lower = col.lower()
                if 'month' in col_lower and 'number' in col_lower:
                    month_col = col
                if 'year' in col_lower:
                    year_col = col
            
            if month_col and year_col:
                sales_col = None
                profit_col = None
                for col in df.columns:
                    col_lower = col.lower()
                    if 'sales' in col_lower and sales_col is None:
                        sales_col = col
                    if 'profit' in col_lower and profit_col is None:
                        profit_col = col
                
                if sales_col and profit_col:
                    monthly = df.groupby([year_col, month_col]).agg({
                        sales_col: 'sum',
                        profit_col: 'sum'
                    }).reset_index()
                    monthly['Profit Margin %'] = (monthly[profit_col] / monthly[sales_col] * 100).round(2)
                    monthly.columns = ['Year', 'Month', 'Total Sales', 'Total Profit', 'Profit Margin %']
                    return f"Monthly time series:\n{monthly.to_string(index=False)}"
        
        # Discount Band × Product breakdown (common financial analysis)
        if ("discount" in query_lower and "band" in query_lower) or ("discount" in query_lower and "product" in query_lower):
            discount_col = None
            product_col = None
            for col in df.columns:
                col_lower = col.lower()
                if 'discount' in col_lower and 'band' in col_lower:
                    discount_col = col
                if 'product' in col_lower:
                    product_col = col
            
            if discount_col and product_col:
                sales_col = None
                profit_col = None
                cogs_col = None
                for col in df.columns:
                    col_lower = col.lower()
                    if 'sales' in col_lower and sales_col is None:
                        sales_col = col
                    if 'profit' in col_lower and profit_col is None:
                        profit_col = col
                    if 'cogs' in col_lower and cogs_col is None:
                        cogs_col = col
                
                if sales_col and profit_col:
                    breakdown = df.groupby([discount_col, product_col], include_groups=False).agg({
                        sales_col: 'sum',
                        profit_col: 'sum',
                        cogs_col: 'sum' if cogs_col else sales_col
                    }).reset_index()
                    breakdown['Margin %'] = (breakdown[profit_col] / breakdown[sales_col] * 100).round(2)
                    breakdown = breakdown.sort_values([discount_col, product_col])
                    return f"Discount Band × Product Breakdown:\n{breakdown.to_string(index=False)}"
        
        # Segment breakdown
        if "segment" in query_lower and not segment_match:
            segment_col = None
            for col in df.columns:
                if 'segment' in col.lower():
                    segment_col = col
                    break
            
            if segment_col:
                sales_col = None
                profit_col = None
                for col in df.columns:
                    col_lower = col.lower()
                    if 'sales' in col_lower and sales_col is None:
                        sales_col = col
                    if 'profit' in col_lower and profit_col is None:
                        profit_col = col
                
                if sales_col and profit_col:
                    segment_summary = df.groupby(segment_col, include_groups=False).agg({
                        sales_col: ['sum', 'mean', 'count'],
                        profit_col: ['sum', 'mean']
                    }).round(2)
                    return f"Segment breakdown:\n{segment_summary.to_string()}"
        
        # Country breakdown
        if "country" in query_lower and not country_match:
            country_col = None
            for col in df.columns:
                if 'country' in col.lower():
                    country_col = col
                    break
            
            if country_col:
                sales_col = None
                profit_col = None
                for col in df.columns:
                    col_lower = col.lower()
                    if 'sales' in col_lower and sales_col is None:
                        sales_col = col
                    if 'profit' in col_lower and profit_col is None:
                        profit_col = col
                
                if sales_col and profit_col:
                    country_summary = df.groupby(country_col).agg({
                        sales_col: ['sum', 'mean', 'count'],
                        profit_col: ['sum', 'mean']
                    }).round(2)
                    return f"Country breakdown:\n{country_summary.to_string()}"
        
        return f"Query executed. Available columns: {', '.join(df.columns.tolist()[:10])}"
    
    except Exception as e:
        import traceback
        return f"Error querying data: {str(e)}\n{traceback.format_exc()[:500]}"


def chat_node(state: FinanceState) -> Dict:
    """
    Chat node: Handles conversational queries about the financial data.
    Can answer questions about the analysis results, insights, or query the raw data.
    Smart routing: handles greetings and simple queries without requiring full analysis.
    """
    messages = state.get("messages", [])
    analysis_results = state.get("analysis_results", {})
    insights = state.get("insights", "")
    schema_info = state.get("schema_info", {})
    df = state.get("cleaned_df")
    user_intent = state.get("user_intent", "unknown")
    
    if not messages:
        return {"messages": []}
    
    # Get the last user message
    last_message = messages[-1] if messages else None
    if not last_message or not isinstance(last_message, HumanMessage):
        return {"messages": []}
    
    user_query = last_message.content
    
    # Handle greetings and simple interactions
    if user_intent == "greeting" or user_intent == "general_chat":
        greeting_responses = {
            "hi": "Hello! I'm your financial analysis assistant. I can help you analyze financial data, answer questions about sales and profits, generate reports, and create visualizations. How can I help you today?",
            "hello": "Hello! I'm ready to help with financial analysis. You can ask me to analyze CSV data, answer questions about financial metrics, or generate reports. What would you like to do?",
            "help": "I can help you with:\n- Analyzing financial CSV data\n- Answering questions about sales, profits, and trends\n- Generating visualizations and charts\n- Forecasting future trends\n- Detecting anomalies\n- Assessing risks\n- Creating executive reports\n\nJust ask me a question or provide CSV data to get started!",
            "what can you do": "I'm a multi-agent financial analysis system. I can:\n1. Validate and clean financial data\n2. Analyze KPIs (sales, profit, margins)\n3. Generate interactive charts\n4. Forecast trends\n5. Detect anomalies\n6. Assess risks\n7. Create executive reports\n8. Answer questions about your data\n\nWould you like me to analyze some financial data?"
        }
        
        query_lower = user_query.lower().strip()
        for key, response in greeting_responses.items():
            if query_lower.startswith(key) or query_lower == key:
                ai_message = AIMessage(content=response)
                return {"messages": [ai_message]}
        
        # Generic greeting response
        ai_message = AIMessage(content="Hello! I'm your financial analysis assistant. I can analyze CSV data, answer questions about financial metrics, generate reports, and create visualizations. How can I help you today?")
        return {"messages": [ai_message]}
    
    # Try to query the DataFrame first for specific questions
    query_result = None
    if df is not None and not df.empty:
        query_result = query_dataframe(df, user_query)
    
    # Build context from available data
    context = "You are a financial analyst assistant with access to financial data. "
    
    # Add DataFrame query results if available
    if query_result and "Error" not in query_result:
        context += f"\n**Actual Data Query Results:**\n{query_result}\n\n"
    
    if analysis_results:
        context += f"""
Available Financial Analysis Summary:
- Total Sales: ${analysis_results.get('total_sales', 0):,.2f}
- Total Profit: ${analysis_results.get('total_profit', 0):,.2f}
- Profit Margin: {analysis_results.get('profit_margin', 0):.2f}%
- Total Records: {analysis_results.get('total_records', 0)}

Top Countries by Sales:
"""
        if analysis_results.get("top_countries_by_sales"):
            for country, sales in list(analysis_results["top_countries_by_sales"].items())[:5]:
                context += f"  - {country}: ${sales:,.2f}\n"
        
        context += "\nTop Segments by Profit:\n"
        if analysis_results.get("top_segments_by_profit"):
            for segment, profit in list(analysis_results["top_segments_by_profit"].items())[:5]:
                context += f"  - {segment}: ${profit:,.2f}\n"
    
    if insights:
        context += f"\nPrevious Insights:\n{insights}\n"
    
    if schema_info:
        context += f"\nDataset has {schema_info.get('row_count', 0)} rows and {schema_info.get('column_count', 0)} columns.\n"
        context += f"Available columns: {', '.join(schema_info.get('columns', []))}\n"
    
    # Create prompt for the LLM
    if query_result and "Error" not in query_result and "Query executed" not in query_result:
        # We have actual data - prioritize it
        prompt = f"""You are a financial analyst assistant with access to actual financial data.

**ACTUAL DATA QUERY RESULTS:**
{query_result}

User Question: {user_query}

**CRITICAL**: The query results above contain EXACT numbers from the dataset. Use these exact numbers in your answer. 
Do NOT estimate, calculate, or guess - use the precise values shown above.

Provide a clear, professional answer using the exact numbers from the query results. Be precise and actionable."""
    else:
        # No specific query match - use summary data
        prompt = f"""{context}

User Question: {user_query}

Provide a helpful, professional answer about the financial data. Be precise, use actual numbers from the data, and be actionable."""
    
    try:
        response = llm.invoke(prompt)
        ai_message = AIMessage(content=response.content)
        
        return {"messages": [ai_message]}
    
    except Exception as e:
        error_message = AIMessage(content=f"I apologize, but I encountered an error: {str(e)}")
        return {"messages": [error_message]}


def generate_insights(state: FinanceState) -> Dict:
    """
    Node 4: Generate AI-powered insights and narrative summary.
    """
    analysis_results = state.get("analysis_results", {})
    df = state.get("cleaned_df")
    schema_info = state.get("schema_info", {})
    
    if not analysis_results or df is None or df.empty:
        return {"insights": "Unable to generate insights: missing data or analysis results."}
    
    try:
        # Prepare data summary for LLM
        summary_text = f"""
Financial Dataset Analysis Summary:

Dataset Overview:
- Total Records: {analysis_results.get('total_records', 'N/A')}
- Columns: {', '.join(schema_info.get('columns', []))}

Key Metrics:
"""
        
        if analysis_results.get("total_sales"):
            summary_text += f"- Total Sales: {analysis_results['total_sales']:,.2f}\n"
        
        if analysis_results.get("total_profit"):
            summary_text += f"- Total Profit: {analysis_results['total_profit']:,.2f}\n"
        
        if analysis_results.get("profit_margin"):
            summary_text += f"- Profit Margin: {analysis_results['profit_margin']:.2f}%\n"
        
        if analysis_results.get("top_countries_by_sales"):
            summary_text += f"\nTop Countries by Sales:\n"
            for country, sales in analysis_results["top_countries_by_sales"].items():
                summary_text += f"  - {country}: {sales:,.2f}\n"
        
        if analysis_results.get("top_segments_by_profit"):
            summary_text += f"\nTop Segments by Profit:\n"
            for segment, profit in analysis_results["top_segments_by_profit"].items():
                summary_text += f"  - {segment}: {profit:,.2f}\n"
        
        if analysis_results.get("sales_by_country"):
            summary_text += f"\nSales Breakdown by Country:\n"
            for country, stats in list(analysis_results["sales_by_country"].items())[:5]:
                summary_text += f"  - {country}: Total={stats.get('sum', 0):,.2f}, Avg={stats.get('mean', 0):,.2f}\n"
        
        # Generate insights using LLM
        prompt = f"""You are a financial analyst. Analyze the following financial data and provide key insights in a clear, professional narrative.

{summary_text}

Provide:
1. A 2-3 sentence executive summary
2. Key findings (3-5 bullet points)
3. Notable patterns or anomalies
4. Business recommendations (if applicable)

Write in a professional, Swiss business tone - precise, clear, and actionable."""

        response = llm.invoke(prompt)
        insights = response.content
        
        return {"insights": insights}
    
    except Exception as e:
        return {
            "insights": f"Failed to generate insights: {str(e)}\n\nRaw analysis data:\n{json.dumps(analysis_results, indent=2, default=str)}"
        }


def visualization_agent(state: FinanceState) -> Dict:
    """
    Agent 2: Visualization Agent
    Creates interactive charts using Plotly - sales by country, profit trends, segment distribution, etc.
    """
    df = state.get("cleaned_df")
    analysis_results = state.get("analysis_results", {})
    
    if df is None or df.empty or not PLOTLY_AVAILABLE:
        return {"charts": {}}
    
    charts = {}
    
    try:
        # Find key columns
        country_col = None
        segment_col = None
        sales_col = None
        profit_col = None
        month_col = None
        year_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'country' in col_lower:
                country_col = col
            if 'segment' in col_lower:
                segment_col = col
            if 'sales' in col_lower and sales_col is None:
                sales_col = col
            if 'profit' in col_lower and profit_col is None:
                profit_col = col
            if 'month' in col_lower and 'number' in col_lower:
                month_col = col
            if 'year' in col_lower:
                year_col = col
        
        # Chart 1: Sales by Country (Bar Chart)
        if country_col and sales_col:
            sales_by_country = df.groupby(country_col)[sales_col].sum().sort_values(ascending=False)
            fig = px.bar(
                x=sales_by_country.index,
                y=sales_by_country.values,
                title="Sales by Country",
                labels={"x": "Country", "y": "Total Sales ($)"},
                color=sales_by_country.values,
                color_continuous_scale="Blues"
            )
            charts["sales_by_country"] = fig.to_json()
        
        # Chart 2: Profit by Segment (Pie Chart)
        if segment_col and profit_col:
            profit_by_segment = df.groupby(segment_col)[profit_col].sum()
            fig = px.pie(
                values=profit_by_segment.values,
                names=profit_by_segment.index,
                title="Profit Distribution by Segment"
            )
            charts["profit_by_segment"] = fig.to_json()
        
        # Chart 3: Monthly Sales Trend (Line Chart)
        if month_col and year_col and sales_col:
            df['DateKey'] = df[year_col].astype(str) + '-' + df[month_col].astype(str).str.zfill(2)
            monthly_sales = df.groupby('DateKey')[sales_col].sum().sort_index()
            fig = px.line(
                x=monthly_sales.index,
                y=monthly_sales.values,
                title="Monthly Sales Trend",
                labels={"x": "Month", "y": "Total Sales ($)"},
                markers=True
            )
            charts["monthly_sales_trend"] = fig.to_json()
        
        # Chart 4: Profit Margin Heatmap (Country x Segment)
        if country_col and segment_col and sales_col and profit_col:
            pivot_data = df.groupby([country_col, segment_col]).agg({
                sales_col: 'sum',
                profit_col: 'sum'
            }).reset_index()
            pivot_data['Profit Margin'] = (pivot_data[profit_col] / pivot_data[sales_col] * 100).round(2)
            pivot_table = pivot_data.pivot(index=country_col, columns=segment_col, values='Profit Margin')
            fig = px.imshow(
                pivot_table.values,
                labels=dict(x="Segment", y="Country", color="Profit Margin (%)"),
                x=pivot_table.columns,
                y=pivot_table.index,
                title="Profit Margin Heatmap (Country × Segment)",
                color_continuous_scale="RdYlGn"
            )
            charts["profit_margin_heatmap"] = fig.to_json()
        
        return {"charts": charts}
    
    except Exception as e:
        return {"charts": {}, "chart_error": str(e)}


def forecasting_agent(state: FinanceState) -> Dict:
    """
    Agent 3: Forecasting Agent
    Predicts future trends using simple statistical methods.
    Only runs when data is available and analysis is needed.
    """
    df = state.get("cleaned_df")
    analysis_results = state.get("analysis_results", {})
    user_intent = state.get("user_intent", "")
    
    if df is None or df.empty:
        return {"forecasts": {}}
    
    # Skip forecasting for simple greetings
    if user_intent in ["greeting", "general_chat"]:
        return {"forecasts": {}}
    
    forecasts = {
        "timestamp": datetime.now().isoformat(),
        "method": "simple_average_growth"
    }
    
    try:
        # Find time and sales columns
        month_col = None
        year_col = None
        sales_col = None
        profit_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'month' in col_lower and 'number' in col_lower:
                month_col = col
            if 'year' in col_lower:
                year_col = col
            if 'sales' in col_lower and sales_col is None:
                sales_col = col
            if 'profit' in col_lower and profit_col is None:
                profit_col = col
        
        if month_col and year_col and sales_col:
            # Aggregate monthly sales
            df['DateKey'] = df[year_col].astype(str) + '-' + df[month_col].astype(str).str.zfill(2)
            monthly = df.groupby('DateKey').agg({
                sales_col: 'sum',
                profit_col: 'sum' if profit_col else sales_col
            }).sort_index()
            
            if len(monthly) >= 3:
                # Simple forecast: average of last 3 months
                recent_avg_sales = monthly[sales_col].tail(3).mean()
                recent_avg_profit = monthly[profit_col].tail(3).mean() if profit_col else 0
                
                # Calculate growth rate
                if len(monthly) >= 6:
                    older_avg = monthly[sales_col].tail(6).head(3).mean()
                    growth_rate = ((recent_avg_sales - older_avg) / older_avg * 100) if older_avg > 0 else 0
                else:
                    growth_rate = 0
                
                # Forecast next quarter (3 months)
                next_quarter_sales = recent_avg_sales * 3 * (1 + growth_rate / 100)
                next_quarter_profit = recent_avg_profit * 3 * (1 + growth_rate / 100) if profit_col else 0
                
                forecasts["next_quarter"] = {
                    "predicted_sales": float(next_quarter_sales),
                    "predicted_profit": float(next_quarter_profit),
                    "growth_rate": float(growth_rate),
                    "confidence": "medium"
                }
        
        return {"forecasts": forecasts}
    
    except Exception as e:
        return {"forecasts": {"error": str(e)}}


def anomaly_detection_agent(state: FinanceState) -> Dict:
    """
    Agent 4: Anomaly Detection Agent
    Finds unusual patterns, outliers, and suspicious transactions.
    Only runs when data is available and analysis is needed.
    """
    df = state.get("cleaned_df")
    user_intent = state.get("user_intent", "")
    
    if df is None or df.empty:
        return {"anomalies": []}
    
    # Skip anomaly detection for simple greetings
    if user_intent in ["greeting", "general_chat"]:
        return {"anomalies": []}
    
    anomalies = []
    
    try:
        # Find key columns
        sales_col = None
        profit_col = None
        country_col = None
        segment_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'sales' in col_lower and sales_col is None:
                sales_col = col
            if 'profit' in col_lower and profit_col is None:
                profit_col = col
            if 'country' in col_lower:
                country_col = col
            if 'segment' in col_lower:
                segment_col = col
        
        # Anomaly 1: Negative profit margins
        if sales_col and profit_col:
            df['Profit Margin'] = (df[profit_col] / df[sales_col] * 100).round(2)
            negative_margins = df[df['Profit Margin'] < 0]
            if len(negative_margins) > 0:
                anomalies.append({
                    "type": "negative_profit_margin",
                    "severity": "high",
                    "count": len(negative_margins),
                    "description": f"Found {len(negative_margins)} transactions with negative profit margins"
                })
        
        # Anomaly 2: Statistical outliers (using z-score)
        if STATS_AVAILABLE and sales_col:
            z_scores = np.abs(stats.zscore(df[sales_col].dropna()))
            outliers = df[z_scores > 3]
            if len(outliers) > 0:
                anomalies.append({
                    "type": "sales_outliers",
                    "severity": "medium",
                    "count": len(outliers),
                    "description": f"Found {len(outliers)} transactions with unusually high/low sales (z-score > 3)"
                })
        
        # Anomaly 3: Unusual profit margins by segment
        if segment_col and sales_col and profit_col:
            segment_margins = df.groupby(segment_col, include_groups=False).apply(
                lambda x: (x[profit_col].sum() / x[sales_col].sum() * 100) if x[sales_col].sum() > 0 else 0
            )
            avg_margin = segment_margins.mean()
            unusual_segments = segment_margins[(segment_margins < avg_margin * 0.5) | (segment_margins > avg_margin * 1.5)]
            if len(unusual_segments) > 0:
                anomalies.append({
                    "type": "unusual_segment_margins",
                    "severity": "medium",
                    "segments": unusual_segments.to_dict(),
                    "description": f"Found {len(unusual_segments)} segments with profit margins significantly different from average"
                })
        
        return {"anomalies": anomalies}
    
    except Exception as e:
        return {"anomalies": [{"type": "error", "description": str(e)}]}


def risk_analysis_agent(state: FinanceState) -> Dict:
    """
    Agent 5: Risk Analysis Agent
    Assesses financial risks - concentration risk, profitability risk, etc.
    Only runs when data is available and analysis is needed.
    """
    df = state.get("cleaned_df")
    analysis_results = state.get("analysis_results", {})
    user_intent = state.get("user_intent", "")
    
    if df is None or df.empty:
        return {"risk_report": {}}
    
    # Skip risk analysis for simple greetings
    if user_intent in ["greeting", "general_chat"]:
        return {"risk_report": {}}
    
    risk_report = {
        "timestamp": datetime.now().isoformat(),
        "risks": []
    }
    
    try:
        # Find key columns
        country_col = None
        segment_col = None
        sales_col = None
        profit_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'country' in col_lower:
                country_col = col
            if 'segment' in col_lower:
                segment_col = col
            if 'sales' in col_lower and sales_col is None:
                sales_col = col
            if 'profit' in col_lower and profit_col is None:
                profit_col = col
        
        total_sales = analysis_results.get("total_sales", df[sales_col].sum() if sales_col else 0)
        total_profit = analysis_results.get("total_profit", df[profit_col].sum() if profit_col else 0)
        
        # Risk 1: Concentration Risk (Country)
        if country_col and sales_col:
            country_sales = df.groupby(country_col)[sales_col].sum()
            top_country_share = country_sales.max() / total_sales * 100 if total_sales > 0 else 0
            if top_country_share > 30:
                risk_report["risks"].append({
                    "type": "geographic_concentration",
                    "severity": "high" if top_country_share > 50 else "medium",
                    "description": f"Top country accounts for {top_country_share:.1f}% of sales",
                    "recommendation": "Consider diversifying geographic revenue sources"
                })
        
        # Risk 2: Segment Concentration Risk
        if segment_col and profit_col:
            segment_profit = df.groupby(segment_col)[profit_col].sum()
            top_segment_share = segment_profit.max() / total_profit * 100 if total_profit > 0 else 0
            if top_segment_share > 50:
                risk_report["risks"].append({
                    "type": "segment_concentration",
                    "severity": "high",
                    "description": f"Top segment accounts for {top_segment_share:.1f}% of profit",
                    "recommendation": "Diversify revenue across multiple segments"
                })
        
        # Risk 3: Profitability Risk
        if sales_col and profit_col:
            overall_margin = (total_profit / total_sales * 100) if total_sales > 0 else 0
            if overall_margin < 10:
                risk_report["risks"].append({
                    "type": "low_profitability",
                    "severity": "medium",
                    "description": f"Overall profit margin is {overall_margin:.1f}% (below 10%)",
                    "recommendation": "Review cost structure and pricing strategy"
                })
        
        # Overall risk score
        high_risks = sum(1 for r in risk_report["risks"] if r["severity"] == "high")
        medium_risks = sum(1 for r in risk_report["risks"] if r["severity"] == "medium")
        risk_report["overall_risk_score"] = "high" if high_risks > 0 else "medium" if medium_risks > 2 else "low"
        risk_report["summary"] = f"Risk assessment: {risk_report['overall_risk_score']} risk ({high_risks} high, {medium_risks} medium)"
        
        return {"risk_report": risk_report}
    
    except Exception as e:
        return {"risk_report": {"error": str(e)}}


def report_generator_agent(state: FinanceState) -> Dict:
    """
    Agent 6: Report Generator Agent
    Creates a comprehensive executive report combining all analysis results.
    Only runs when full analysis has been performed.
    """
    analysis_results = state.get("analysis_results", {})
    insights = state.get("insights", "")
    data_quality_report = state.get("data_quality_report", {})
    forecasts = state.get("forecasts", {})
    anomalies = state.get("anomalies", [])
    risk_report = state.get("risk_report", {})
    user_intent = state.get("user_intent", "")
    
    # Skip report generation for simple greetings
    if user_intent in ["greeting", "general_chat"]:
        return {"generated_report": None}
    
    # Only generate report if we have analysis results
    if not analysis_results:
        return {"generated_report": None}
    
    try:
        report_sections = []
        
        # Executive Summary
        report_sections.append("=" * 70)
        report_sections.append("EXECUTIVE FINANCIAL ANALYSIS REPORT")
        report_sections.append("=" * 70)
        report_sections.append(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # Data Quality Section
        if data_quality_report and not data_quality_report.get("error"):
            quality_score = data_quality_report.get("quality_score", "unknown")
            report_sections.append(f"DATA QUALITY: {quality_score.upper()}")
            report_sections.append(f"  - Total Records: {data_quality_report.get('total_records', 'N/A')}")
            report_sections.append(f"  - Quality Score: {quality_score}")
            report_sections.append("")
        
        # Key Metrics
        if analysis_results:
            report_sections.append("KEY FINANCIAL METRICS")
            report_sections.append("-" * 70)
            if analysis_results.get("total_sales"):
                report_sections.append(f"  Total Sales: ${analysis_results['total_sales']:,.2f}")
            if analysis_results.get("total_profit"):
                report_sections.append(f"  Total Profit: ${analysis_results['total_profit']:,.2f}")
            if analysis_results.get("profit_margin"):
                report_sections.append(f"  Profit Margin: {analysis_results['profit_margin']:.2f}%")
            report_sections.append("")
        
        # Insights
        if insights:
            report_sections.append("AI-GENERATED INSIGHTS")
            report_sections.append("-" * 70)
            report_sections.append(insights)
            report_sections.append("")
        
        # Forecasts
        if forecasts and forecasts.get("next_quarter"):
            report_sections.append("FORECASTS")
            report_sections.append("-" * 70)
            next_q = forecasts["next_quarter"]
            report_sections.append(f"  Next Quarter Predicted Sales: ${next_q.get('predicted_sales', 0):,.2f}")
            report_sections.append(f"  Growth Rate: {next_q.get('growth_rate', 0):.2f}%")
            report_sections.append("")
        
        # Anomalies
        if anomalies:
            report_sections.append("DETECTED ANOMALIES")
            report_sections.append("-" * 70)
            for anomaly in anomalies[:5]:  # Top 5
                report_sections.append(f"  [{anomaly.get('severity', 'unknown').upper()}] {anomaly.get('description', 'Unknown')}")
            report_sections.append("")
        
        # Risks
        if risk_report and risk_report.get("risks"):
            report_sections.append("RISK ASSESSMENT")
            report_sections.append("-" * 70)
            report_sections.append(f"  Overall Risk Score: {risk_report.get('overall_risk_score', 'unknown').upper()}")
            for risk in risk_report["risks"][:5]:  # Top 5
                report_sections.append(f"  [{risk.get('severity', 'unknown').upper()}] {risk.get('description', 'Unknown')}")
                if risk.get('recommendation'):
                    report_sections.append(f"    → Recommendation: {risk['recommendation']}")
            report_sections.append("")
        
        report_sections.append("=" * 70)
        report_sections.append("END OF REPORT")
        report_sections.append("=" * 70)
        
        report_content = "\n".join(report_sections)
        
        return {"generated_report": report_content}
    
    except Exception as e:
        return {"generated_report": f"Report generation failed: {str(e)}"}


# Build Data Processing Subgraph
# This subgraph handles: load_inspect → clean_normalize → analyze
# All other agents use the output from this subgraph
data_processing_subgraph = StateGraph(FinanceState)
data_processing_subgraph.add_node("load_inspect", load_and_inspect_csv)
data_processing_subgraph.add_node("clean_normalize", clean_and_normalize)
data_processing_subgraph.add_node("analyze", analyze_and_summarize)

# Subgraph flow: sequential data processing
data_processing_subgraph.set_entry_point("load_inspect")
data_processing_subgraph.add_edge("load_inspect", "clean_normalize")
data_processing_subgraph.add_edge("clean_normalize", "analyze")
data_processing_subgraph.add_edge("analyze", END)

# Compile the subgraph
data_processing_app = data_processing_subgraph.compile()


# Wrapper function to invoke the subgraph
def data_processing_pipeline(state: FinanceState) -> Dict:
    """
    Data Processing Pipeline: Load → Clean → Analyze
    This is a subgraph that processes raw CSV data into analyzed results.
    All other agents use the output from this pipeline.
    """
    # Invoke the subgraph with current state
    result = data_processing_app.invoke(state)
    return result


# Build the Main LangGraph workflow
workflow = StateGraph(FinanceState)

# Add nodes
workflow.add_node("supervisor", supervisor_agent)
workflow.add_node("data_quality", data_quality_agent)
workflow.add_node("data_processing", data_processing_pipeline)  # Subgraph as single node
workflow.add_node("insights", generate_insights)
workflow.add_node("visualization", visualization_agent)
workflow.add_node("forecasting", forecasting_agent)
workflow.add_node("anomaly_detection", anomaly_detection_agent)
workflow.add_node("risk_analysis", risk_analysis_agent)
workflow.add_node("report_generator", report_generator_agent)
# Chat node removed - supervisor handles chat directly

# Define the flow
# True Supervisor Pattern: Supervisor decides which agent to call at each step

def route_entry(state: FinanceState) -> str:
    """Entry point: always start with supervisor"""
    return "supervisor"


def route_from_supervisor(state: FinanceState) -> str:
    """
    Supervisor decides which agent to invoke next based on current state.
    Supervisor can also handle chat directly (returns "__end__" in that case).
    """
    next_action = state.get("next_action")
    
    # If supervisor handled chat directly, it returns "__end__"
    if next_action == "__end__":
        return END
    
    # Supervisor's decision on what to do next
    if next_action == "data_quality":
        return "data_quality"
    elif next_action == "data_processing":
        return "data_processing"  # Subgraph: load → clean → analyze
    elif next_action == "insights":
        return "insights"
    elif next_action == "visualization":
        return "visualization"
    elif next_action == "forecasting":
        return "forecasting"
    elif next_action == "anomaly_detection":
        return "anomaly_detection"
    elif next_action == "risk_analysis":
        return "risk_analysis"
    elif next_action == "report_generator":
        return "report_generator"
    else:
        # Default: end (supervisor handled everything)
        return END


def route_after_agent(state: FinanceState) -> str:
    """
    After each agent completes, return to supervisor to decide next step.
    Supervisor orchestrates the entire workflow.
    """
    # Always return to supervisor after an agent completes
    return "supervisor"


workflow.set_conditional_entry_point(route_entry)

# Supervisor is the central orchestrator - routes to agents conditionally OR handles chat directly
workflow.add_conditional_edges("supervisor", route_from_supervisor)

# After each agent completes, return to supervisor for next decision
workflow.add_conditional_edges("data_quality", route_after_agent)
workflow.add_conditional_edges("data_processing", route_after_agent)  # Subgraph returns to supervisor
workflow.add_conditional_edges("insights", route_after_agent)
workflow.add_conditional_edges("visualization", route_after_agent)
workflow.add_conditional_edges("forecasting", route_after_agent)
workflow.add_conditional_edges("anomaly_detection", route_after_agent)
workflow.add_conditional_edges("risk_analysis", route_after_agent)
workflow.add_conditional_edges("report_generator", route_after_agent)

# Compile the graph
app = workflow.compile()

# For LangGraph Studio and direct execution
if __name__ == "__main__":
    # Example usage with sample data
    sample_csv = """Segment,Country,Product,Discount Band,Units Sold,Manufacturing Price,Sale Price,Gross Sales,Discounts,Sales,COGS,Profit,Date,Month Number,Month Name,Year
Government,Canada,Carretera,None,1618.5,3,20,32370,0,32370,16185,16185,2014-01-01,1,January,2014
Government,Germany,Carretera,None,1321,3,20,26420,0,26420,13210,13210,2014-01-01,1,January,2014
Midmarket,France,Carretera,None,2178,3,15,32670,0,32670,21780,10890,2014-06-01,6,June,2014
Midmarket,Germany,Carretera,None,888,3,15,13320,0,13320,8880,4440,2014-06-01,6,June,2014
Government,Mexico,Carretera,None,2470,3,15,37050,0,37050,24700,12350,2014-06-01,6,June,2014"""
    
    initial_state = {
        "messages": [],
        "raw_csv": sample_csv,
        "csv_path": None,
        "schema_info": {},
        "cleaned_df": None,
        "analysis_results": {},
        "insights": "",
        "data_quality_report": {},
        "charts": {},
        "forecasts": {},
        "anomalies": [],
        "risk_report": {},
        "generated_report": None,
        "user_intent": None,
        "next_action": None
    }
    
    print("\n" + "="*70)
    print("🧾 LangGraph Finance Demo: Financial Data Analysis")
    print("="*70)
    print("\n🔄 Running workflow...\n")
    
    result = app.invoke(initial_state)
    
    print("\n" + "="*70)
    print("📊 RESULTS")
    print("="*70)
    
    print(f"\n📋 Schema Info:")
    print(f"  Rows: {result['schema_info'].get('row_count', 'N/A')}")
    print(f"  Columns: {result['schema_info'].get('column_count', 'N/A')}")
    print(f"  Column names: {', '.join(result['schema_info'].get('columns', []))}")
    
    if result.get('analysis_results'):
        print(f"\n💰 Analysis Results:")
        if result['analysis_results'].get('total_sales'):
            print(f"  Total Sales: {result['analysis_results']['total_sales']:,.2f}")
        if result['analysis_results'].get('total_profit'):
            print(f"  Total Profit: {result['analysis_results']['total_profit']:,.2f}")
    
    if result.get('insights'):
        print(f"\n💡 AI-Generated Insights:")
        print(f"  {result['insights']}")
    
    print("\n" + "="*70 + "\n")
