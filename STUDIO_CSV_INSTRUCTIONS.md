# 📊 Using Financials.csv in Studio

## ✅ File Ready!

Your `Financials.csv` (701 rows) has been copied to the demo directory.

## 🎯 Option 1: Use csv_path (Easiest!)

In LangGraph Studio, use the `csv_path` field instead of `raw_csv`:

1. **Leave `raw_csv` empty** (or don't fill it)
2. **Set `csv_path` to**: `/Users/romainmagnin/Desktop/demo/Financials.csv`
3. **Click Submit**

The workflow will automatically load the file!

## 🎯 Option 2: Paste CSV Content

If you prefer to paste the content:

1. **Open** `/Users/romainmagnin/Desktop/demo/Financials.csv` in a text editor
2. **Select All** (Cmd+A)
3. **Copy** (Cmd+C)
4. **In Studio**, paste into the `raw_csv` field
5. **Click Submit**

## 💡 Recommended: Use csv_path

Using `csv_path` is better because:
- ✅ No need to copy/paste 701 rows
- ✅ Faster
- ✅ Less error-prone
- ✅ Works with large files

## 📋 Studio Input Format

```json
{
  "csv_path": "/Users/romainmagnin/Desktop/demo/Financials.csv",
  "raw_csv": "",
  "schema_info": {},
  "cleaned_df": null,
  "analysis_results": {},
  "insights": ""
}
```

Or just set `csv_path` and leave others empty/default.

## 🚀 Ready to Run!

Your workflow will process all 701 rows and generate comprehensive insights!

