# 🔧 Troubleshooting Studio Connection

## Issue: "Failed to fetch" / "Failed to initialize Studio"

Even with the tunnel, sometimes Studio has connection issues. Here are solutions:

## ✅ Solution 1: Wait a Moment

The tunnel URL can take 30-60 seconds to fully propagate. Wait a minute and refresh the page.

## ✅ Solution 2: Use Direct API Test

Test if the tunnel is working:

```bash
curl https://combo-beverages-actions-hoped.trycloudflare.com/docs
```

If this returns HTML, the tunnel is working.

## ✅ Solution 3: Try Different Browser

- Chrome: Usually most reliable
- Firefox: Good alternative
- Safari: Sometimes has issues

## ✅ Solution 4: Clear Browser Cache

1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Or clear browser cache and try again

## ✅ Solution 5: Check Tunnel Status

Look at your terminal - you should see:
- `Registered tunnel connection` ✅
- `Registering graph with id 'finance_analyzer'` ✅

If you see errors, restart the server.

## ✅ Solution 6: Use Command Line Demo Instead

If Studio continues to have issues, the command-line demo works perfectly:

```bash
source venv/bin/activate
python run_demo.py
```

This shows the full workflow execution without needing Studio!

## ✅ Solution 7: Restart with Fresh Tunnel

1. Stop the server (Ctrl+C)
2. Wait 10 seconds
3. Restart: `langgraph dev --tunnel`
4. Copy the NEW Studio URL
5. Try again

## 🎯 Quick Test

Run this to verify everything works:

```bash
source venv/bin/activate
python test_workflow.py
```

If this works, your workflow is fine - it's just a Studio connectivity issue.

## 💡 Alternative: Use API Directly

You can also test the API directly:

```bash
curl -X POST https://combo-beverages-actions-hoped.trycloudflare.com/threads \
  -H "Content-Type: application/json" \
  -d '{"assistant_id": "finance_analyzer", "input": {"raw_csv": "Segment,Country,Sales\nGovernment,Canada,32370"}}'
```

But the command-line demo (`python run_demo.py`) is much easier! 🚀

