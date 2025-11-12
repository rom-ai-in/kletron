# 🧾 LangGraph Finance Demo: Agentic Financial Data Cleaner & Analyst

A production-ready LangGraph workflow demonstrating an **agentic finance system** that automatically loads, cleans, normalizes, analyzes, and generates insights from raw financial CSV data - like a "self-driving finance analyst."

## 🎯 What This Demo Shows

- **Multi-agent workflow orchestration** with LangGraph
- **Intelligent data cleaning** - removes formatting, handles missing values, converts datatypes
- **Automated financial analysis** - computes KPIs (sales by country, profit by segment, margins)
- **AI-powered insights** - generates narrative summaries and business recommendations
- **Visual workflow execution** in LangGraph Studio

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Or using pipenv/poetry
pipenv install
```

### 2. Configure Azure OpenAI

```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your Azure OpenAI credentials:
# AZURE_OPENAI_API_KEY=your_azure_api_key
# AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com
# AZURE_OPENAI_DEPLOYMENT=your_deployment_name
```

Or manually create a `.env` file with:
```
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_OPENAI_MODEL=gpt-5-mini
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_MAX_TOKENS=4096
```

### 3. Run the Demo

#### Option A: LangGraph Studio (Recommended for Demo)

```bash
# Start LangGraph Studio
langgraph studio

# Or run directly with your graph
langgraph studio run graph.py
```

Then open `http://localhost:2024` in your browser to see the **visual workflow canvas**.

**In LangGraph Studio:**
1. Upload your CSV file or paste CSV content into the `raw_csv` input field
2. Click "Run" to execute the workflow
3. Watch each node execute: Load → Clean → Analyze → Insights
4. View results in the output panel

#### Option B: Command Line

```bash
# Run the interactive demo (uses sample_financials.csv)
python run_demo.py
```

#### Option C: Use Your Own CSV

```python
from graph import app

# Load your CSV file
with open("your_financials.csv", "r") as f:
    csv_content = f.read()

# Run the workflow
result = app.invoke({
    "raw_csv": csv_content,
    "csv_path": "your_financials.csv"
})

print(result["insights"])
```

## 📊 Demo Flow

1. **Load & Inspect Node**: Reads CSV, extracts schema, identifies columns and data types
2. **Clean & Normalize Node**: Removes currency symbols ($), commas, handles missing values, converts to proper datatypes
3. **Analyze Node**: Computes KPIs:
   - Sales by country
   - Profit by segment
   - Total sales/profit
   - Profit margins
   - Top performers
4. **Insights Node**: Generates AI-powered narrative summary with key findings and recommendations

## 🎬 Demo Script for Tomorrow

### 30-Second Intro
> "This is an agentic finance system built with LangGraph. Watch it automatically clean messy financial CSV data, compute KPIs, and generate insights - all orchestrated by specialized agents working together."

### Live Demo Steps

1. **Show LangGraph Studio** (30s)
   - Point out the visual graph: `Load & Inspect → Clean & Normalize → Analyze → Generate Insights → End`
   - Explain how each node is a specialized agent

2. **Upload CSV Data** (30s)
   - Drag-drop the Kaggle `Financials.csv` file (or use sample_financials.csv)
   - Show the raw data preview

3. **Run the Workflow** (1 min)
   - Click "Run" and watch nodes execute in real-time
   - Show data transformation: raw → cleaned → analyzed
   - Highlight the automatic data cleaning (removing $, commas, etc.)

4. **Review Results** (1 min)
   - Show the financial analysis (sales by country, profit by segment)
   - Point out the AI-generated insights narrative
   - Explain how it identifies patterns and provides recommendations

5. **Connect to Real Data** (optional, 30s)
   - Show how you could connect to live data sources
   - Mention integration with accounting systems or data warehouses

## 📁 Project Structure

```
demo/
├── graph.py              # Main LangGraph workflow definition
├── run_demo.py           # Interactive demo runner
├── sample_financials.csv # Sample financial dataset
├── requirements.txt      # Python dependencies
├── env.example           # Environment variables template
└── README.md            # This file
```

## 📥 Using the Kaggle Dataset

The demo works with the [Company Financials Dataset](https://www.kaggle.com/datasets/your-dataset) from Kaggle:

1. **Download the dataset** from Kaggle
2. **Place `Financials.csv`** in the demo directory
3. **Run the demo:**
   ```bash
   python run_demo.py
   ```
   Or use LangGraph Studio and upload the CSV file

The workflow automatically:
- Detects columns (Sales, Profit, Country, Segment, etc.)
- Cleans formatted numbers ($1,234.56 → 1234.56)
- Computes KPIs by country and segment
- Generates insights about top performers and trends

## 🔧 Customization

### Add Your Own CSV

Place your CSV file in the directory and update `run_demo.py`:

```python
csv_file = "your_financials.csv"
raw_csv = load_csv_file(csv_file)
```

### Change Analysis Metrics

Edit the `analyze_and_summarize` function in `graph.py` to add custom KPIs:

```python
# Add custom analysis
if your_column and metric_column:
    custom_analysis = df.groupby(your_column)[metric_column].sum()
    analysis_results["custom_metric"] = custom_analysis.to_dict()
```

### Extend the Workflow

Add new nodes in `graph.py`:

```python
def visualize_data(state: FinanceState) -> Dict:
    # Generate charts/plots
    return {"visualizations": chart_data}

workflow.add_node("visualize", visualize_data)
workflow.add_edge("insights", "visualize")
```

## 🌟 Features

- ✅ **Intelligent Data Cleaning**: Automatically removes formatting, handles missing values
- ✅ **Smart Column Detection**: Identifies sales, profit, country, segment columns automatically
- ✅ **Comprehensive Analysis**: Computes totals, averages, top performers, breakdowns
- ✅ **AI-Powered Insights**: Generates narrative summaries with business recommendations
- ✅ **Flexible Input**: Works with CSV files or raw CSV strings
- ✅ **Error Handling**: Graceful fallbacks if data is malformed

## 🔗 Integration Ideas

- **CSV Upload API**: Add a REST endpoint to accept CSV uploads
- **Database Connector**: Connect to SQL databases or data warehouses
- **Dashboard**: Connect to a React dashboard showing real-time analysis
- **Ledger Integration**: Post insights back to your accounting system
- **Scheduled Jobs**: Run analysis on a schedule (daily/weekly reports)

## 📝 Notes

- Uses Azure OpenAI (configured via `.env` with your Azure credentials)
- Default model: `gpt-5-mini` (changeable in `.env` via `AZURE_OPENAI_DEPLOYMENT`)
- Temperature set to 0.1 for consistent financial analysis
- Automatically detects common financial columns (Sales, Profit, Country, Segment)
- Handles missing values intelligently (median for numeric, "Unknown" for text)

## 🐛 Troubleshooting

**"AZURE_OPENAI_API_KEY not set"**
- Create a `.env` file with your Azure OpenAI credentials (see `env.example`)
- Ensure all required Azure OpenAI variables are set: API_KEY, ENDPOINT, DEPLOYMENT, API_VERSION

**"Module not found"**
- Run `pip install -r requirements.txt`
- Ensure pandas is installed: `pip install pandas`

**"CSV file not found"**
- Ensure `sample_financials.csv` exists in the directory
- Or provide your own CSV file path in `run_demo.py`

**LangGraph Studio not starting**
- Ensure you have `langgraph` installed: `pip install langgraph`
- Try: `langgraph studio --port 2024`

**Data cleaning issues**
- Check that your CSV has proper headers
- Ensure numeric columns contain numeric data (even if formatted)
- The workflow handles common formatting ($, commas) automatically

## 📚 Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangGraph Studio Guide](https://langchain-ai.github.io/langgraph/tutorials/studio/)
- [Pandas Documentation](https://pandas.pydata.org/docs/)
- [Kaggle Company Financials Dataset](https://www.kaggle.com/datasets)

---

**Ready for your demo tomorrow! 🚀**

The workflow transforms raw financial CSV data into actionable insights automatically - perfect for demonstrating agentic AI capabilities.
