# 🎬 Demo Ready - LangGraph Studio Instructions

## ✅ Your Workflow is Fully Functional!

This guide covers everything you need to run the **LangGraph Finance Demo** in **LangSmith Studio**.

---

## 🚀 Quick Start Commands

### 1. Start LangGraph Dev Server

```bash
cd /Users/romainmagnin/Desktop/demo
source venv/bin/activate
langgraph dev
```

**Expected Output:**
```
- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs
```

### 2. If Safari Blocks Localhost (Use Tunnel)

```bash
cd /Users/romainmagnin/Desktop/demo
source venv/bin/activate
langgraph dev --tunnel
```

This creates a secure HTTPS tunnel that works with Safari.

---

## 🌐 Access LangSmith Studio

### Step 1: Open Studio URL

After starting the server, open this URL in **Chrome or Firefox** (not Safari):

```
https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

**Or if using tunnel**, use the URL shown in terminal output.

### Step 2: Login to LangSmith

- If you don't have an account: **Create a free account** (takes 2 minutes, no credit card)
- If you have an account: **Log in**

### Step 3: Select Your Graph

- You'll see `finance_analyzer` graph available
- Select it to start using

---

## 📊 Running the Demo

### Option A: Process CSV File (Recommended)

1. **In Studio Input Panel**, leave all fields **empty**
2. **Click "Submit"**
3. **The graph will automatically load** `/Users/romainmagnin/Desktop/demo/Financials.csv`

> 💡 **Note**: The CSV path is hardcoded for the demo. If you want to use a different file, you can still provide `csv_path` or `raw_csv` in the input panel.

**What Happens:**
- ✅ Load & Inspect: Reads CSV, extracts schema (700 rows, 16 columns)
- ✅ Clean & Normalize: Removes $, commas, handles missing values
- ✅ Analyze: Computes KPIs (sales by country, profit by segment)
- ✅ Generate Insights: AI-powered narrative summary
- ✅ Chat: Ready for conversational queries

### Option B: Paste CSV Content

1. **Open** `/Users/romainmagnin/Desktop/demo/Financials.csv` in a text editor
2. **Select All** (Cmd+A) and **Copy** (Cmd+C)
3. **In Studio**, paste into the `raw_csv` field
4. **Click "Submit"**

---

## 💬 Using the Chat Feature

After processing CSV data, you can chat with the financial analyst:

### Access Chat

1. **Click the "Chat" tab** in Studio (after running the workflow)
2. **Type your question**, for example:
   - "What are the top 3 countries by sales?"
   - "Which segment has the highest profit margin?"
   - "Can you explain the profit trends?"
   - "What recommendations do you have?"

### Chat Examples

```
User: What are the key insights from this data?
AI: [Provides executive summary and key findings]

User: Which country performed best?
AI: [Analyzes sales data and identifies top performers]

User: What's the profit margin?
AI: [Calculates and explains profit margin]

User: Can you compare segments?
AI: [Compares different business segments]
```

---

## 📋 Complete Workflow Flow

```
Entry Point
    ↓
[Has CSV?] → Yes → Load & Inspect → Clean → Analyze → Insights → Chat → End
    ↓ No
[Has Messages?] → Yes → Chat → End
    ↓ No
Load & Inspect → Clean → Analyze → Insights → Chat → End
```

**Nodes:**
1. **load_inspect**: Reads CSV, extracts schema
2. **clean_normalize**: Removes formatting, handles missing values
3. **analyze**: Computes financial KPIs
4. **insights**: Generates AI narrative summary
5. **chat**: Conversational Q&A about the data

---

## 🎯 Demo Script for Presentation

### 30-Second Intro
> "This is an agentic finance system built with LangGraph. Watch it automatically clean messy financial CSV data, compute KPIs, and generate insights - all orchestrated by specialized agents working together."

### Live Demo Steps (3-4 minutes)

#### Step 1: Show the Graph (30s)
- Point out the visual workflow: `Load → Clean → Analyze → Insights → Chat`
- Explain how each node is a specialized agent

#### Step 2: Process CSV Data (1 min)
- Set `csv_path`: `/Users/romainmagnin/Desktop/demo/Financials.csv`
- Click "Submit"
- Watch nodes execute in real-time
- Show the data transformation happening

#### Step 3: Review Results (1 min)
- Show the financial analysis:
  - Total Sales: $118M+
  - Total Profit: $18M+
  - Profit Margin: ~15%
  - Top countries and segments
- Point out the AI-generated insights narrative

#### Step 4: Demonstrate Chat (1 min)
- Open Chat tab
- Ask: "What are the top 3 countries by sales?"
- Show the contextual response
- Ask: "Which segment has the highest profit?"
- Demonstrate interactive Q&A

#### Step 5: Show Flexibility (30s)
- Mention you can use any CSV file
- Show how the workflow adapts automatically
- Highlight the agentic orchestration

---

## 🔧 Troubleshooting

### Server Won't Start

```bash
# Check if port 2024 is in use
lsof -i :2024

# Use different port
langgraph dev --port 8124
```

### Studio Can't Connect

**Issue**: "Failed to fetch" or "Failed to initialize Studio"

**Solutions:**
1. **Use Chrome/Firefox** (not Safari)
2. **Try tunnel mode**: `langgraph dev --tunnel`
3. **Check server is running**: Look for "Server started" in terminal
4. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Graph Not Loading

**Check:**
```bash
# Verify graph compiles
cd /Users/romainmagnin/Desktop/demo
source venv/bin/activate
python -c "from graph import app; print('✅ Graph loaded')"
```

### Azure OpenAI Errors

**Verify credentials:**
```bash
python -c "
from dotenv import load_dotenv
import os
load_dotenv()
print('API Key:', 'Set' if os.getenv('AZURE_OPENAI_API_KEY') else 'Missing')
print('Endpoint:', os.getenv('AZURE_OPENAI_ENDPOINT', 'Missing'))
"
```

---

## 📁 File Locations

- **Graph definition**: `/Users/romainmagnin/Desktop/demo/graph.py`
- **CSV data**: `/Users/romainmagnin/Desktop/demo/Financials.csv`
- **Configuration**: `/Users/romainmagnin/Desktop/demo/langgraph.json`
- **Environment**: `/Users/romainmagnin/Desktop/demo/.env`

---

## 🎯 Quick Reference Commands

### Start Server
```bash
cd /Users/romainmagnin/Desktop/demo
source venv/bin/activate
langgraph dev
```

### Start with Tunnel (Safari)
```bash
langgraph dev --tunnel
```

### Stop Server
Press `Ctrl+C` in the terminal

### Restart Server
```bash
# Stop (Ctrl+C), then:
langgraph dev
```

### Test Graph
```bash
python -c "from graph import app; print('✅ Graph works')"
```

---

## 📊 Expected Results

When you process `Financials.csv`:

- **Rows processed**: 700
- **Columns**: 16
- **Total Sales**: ~$118,726,350
- **Total Profit**: ~$18,370,708
- **Profit Margin**: ~15.47%
- **Top Country**: United States of America ($25M+)
- **Top Segment**: Government ($11M+ profit)

---

## 💡 Pro Tips

1. **Use `csv_path` instead of `raw_csv`** - Faster and more reliable for large files
2. **Process CSV first, then chat** - Chat has access to all analysis results
3. **Keep server running** - Don't close the terminal while using Studio
4. **Use Chrome** - Most reliable browser for Studio
5. **Check terminal logs** - Shows node execution in real-time

---

## ✅ Everything is Ready!

Your workflow includes:
- ✅ CSV processing (load, clean, analyze)
- ✅ AI-powered insights generation
- ✅ Interactive chat functionality
- ✅ Azure OpenAI integration
- ✅ LangGraph Studio visualization

**Just run `langgraph dev` and open Studio!** 🚀

---

## 📚 Additional Resources

- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **LangGraph Studio**: https://smith.langchain.com
- **Project README**: `/Users/romainmagnin/Desktop/demo/README.md`
