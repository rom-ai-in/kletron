# 🧪 Testing LangGraph Studio - Quick Commands

## Quick Start (All-in-One)

```bash
# Run the test script (handles everything)
./test_studio.sh
```

## Manual Step-by-Step

### 1. Install Dependencies

```bash
# Create virtual environment (if not exists)
python3 -m venv venv
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Install LangGraph Studio
pip install langgraph-studio
# OR
pip install langgraph[studio]
```

### 2. Configure Environment

```bash
# Ensure .env file exists with Azure OpenAI credentials
# If not, copy from example:
cp env.example .env

# Edit .env and add your credentials:
# AZURE_OPENAI_API_KEY=your_key
# AZURE_OPENAI_ENDPOINT=your_endpoint
# etc.
```

### 3. Start LangGraph Studio

```bash
# From the demo directory
langgraph studio run graph.py
```

Studio will start at: **http://localhost:2024**

### 4. Test in LangGraph Studio

1. **Open browser**: Navigate to `http://localhost:2024`
2. **Upload CSV**: 
   - Click on the input field for `raw_csv`
   - Either paste CSV content OR
   - Use the sample data by clicking "Load Sample"
3. **Run workflow**: Click "Run" button
4. **Watch execution**: See each node execute:
   - `load_inspect` → `clean_normalize` → `analyze` → `insights`
5. **View results**: Check the output panel for:
   - Schema info
   - Cleaned data preview
   - Analysis results
   - AI-generated insights

## Alternative: Test via Command Line First

```bash
# Test the workflow directly (without Studio)
python run_demo.py
```

This will:
- Load `sample_financials.csv`
- Run the entire workflow
- Display results in terminal
- Save results to `demo_results.json`

## Quick Test Commands

```bash
# 1. Check if dependencies are installed
python -c "import langgraph; import pandas; import langchain_openai; print('✅ All dependencies OK')"

# 2. Check if .env is configured
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('✅ Azure OpenAI Key:', 'Set' if os.getenv('AZURE_OPENAI_API_KEY') else 'Missing')"

# 3. Test graph import
python -c "from graph import app; print('✅ Graph loaded successfully')"

# 4. Run a quick test
python -c "
from graph import app
import pandas as pd

# Load sample CSV
with open('sample_financials.csv', 'r') as f:
    csv_content = f.read()

# Run workflow
result = app.invoke({'raw_csv': csv_content, 'csv_path': None, 'schema_info': {}, 'cleaned_df': None, 'analysis_results': {}, 'insights': ''})

print('✅ Workflow executed successfully!')
print(f'📊 Rows processed: {result[\"schema_info\"].get(\"row_count\", 0)}')
print(f'💰 Total Sales: ${result[\"analysis_results\"].get(\"total_sales\", 0):,.2f}')
print(f'💡 Insights generated: {len(result[\"insights\"])} characters')
"
```

## Troubleshooting

### Studio won't start
```bash
# Check if port 2024 is available
lsof -i :2024

# Use different port
langgraph studio run graph.py --port 3000
```

### Import errors
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

### Azure OpenAI errors
```bash
# Verify .env file
cat .env | grep AZURE_OPENAI

# Test Azure connection
python -c "
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
load_dotenv()

llm = ChatOpenAI(
    azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
    azure_deployment=os.getenv('AZURE_OPENAI_DEPLOYMENT'),
    openai_api_version=os.getenv('AZURE_OPENAI_API_VERSION'),
    openai_api_key=os.getenv('AZURE_OPENAI_API_KEY')
)
print('✅ Azure OpenAI connection OK')
"
```

## Expected Output in Studio

When you run the workflow in Studio, you should see:

1. **Input**: CSV content in `raw_csv` field
2. **Node Execution**:
   - `load_inspect`: ✅ (shows schema info)
   - `clean_normalize`: ✅ (shows cleaned DataFrame)
   - `analyze`: ✅ (shows analysis results)
   - `insights`: ✅ (shows AI-generated text)
3. **Final Output**: Complete state with all results

## Next Steps

Once Studio is running:
- Try different CSV files
- Modify the graph nodes
- Add new analysis nodes
- Export results

