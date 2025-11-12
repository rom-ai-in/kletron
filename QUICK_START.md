# 🚀 Quick Start Guide

## ✅ Everything is Ready!

Your LangGraph finance demo is **fully configured and working**.

## 🎯 Test Commands

### 1. Quick Test (Command Line) - ✅ Works Now

```bash
source venv/bin/activate
python run_demo.py
```

**This shows the full workflow in action!**

### 2. LangGraph Studio (Web UI) - ✅ Ready

```bash
source venv/bin/activate
langgraph dev
```

Then:
- Open the URL shown in the output (or go to https://smith.langchain.com)
- Your graph `finance_analyzer` will be available
- Upload CSV data and run the workflow visually

### 3. Verify Setup

```bash
source venv/bin/activate
python test_workflow.py
```

## 📋 What's Configured

✅ `langgraph.json` - Configuration file created  
✅ `graph.py` - Workflow with 4 nodes  
✅ `sample_financials.csv` - Sample data  
✅ `.env` - Azure OpenAI credentials  
✅ All dependencies installed  

## 🎬 Demo Flow

1. **Load & Inspect** → Reads CSV, extracts schema
2. **Clean & Normalize** → Removes formatting, handles missing values
3. **Analyze** → Computes KPIs (sales by country, profit by segment)
4. **Generate Insights** → AI-powered narrative summary

## 💡 Tips

- Use `langgraph dev --tunnel` if Safari blocks localhost
- The command-line demo (`python run_demo.py`) works perfectly for demos
- Studio provides visual workflow execution

**You're all set! 🎉**

