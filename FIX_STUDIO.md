# 🔧 Fixing LangGraph Studio Connection Issues

## Common Issue: "Failed to fetch" / "Failed to initialize Studio"

This usually happens when the browser can't connect to your local API server.

## ✅ Solution 1: Use Tunnel (Recommended for Safari/Brave)

Safari and some browsers block `localhost` connections. Use the tunnel flag:

```bash
source venv/bin/activate
langgraph dev --tunnel
```

This creates a secure HTTPS tunnel and gives you a URL like:
```
https://smith.langchain.com/studio/?baseUrl=https://your-tunnel-url.trycloudflare.com
```

## ✅ Solution 2: Check Server is Running

Make sure `langgraph dev` is running in a terminal:

```bash
source venv/bin/activate
langgraph dev
```

You should see:
```
- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

## ✅ Solution 3: Use Different Browser

Try Chrome or Firefox instead of Safari:
- Chrome: Usually works with localhost
- Firefox: Usually works with localhost
- Safari: May block localhost (use --tunnel)

## ✅ Solution 4: Check Port Availability

If port 2024 is busy, use a different port:

```bash
langgraph dev --port 8124
```

Then update the Studio URL to use port 8124.

## ✅ Solution 5: Test API Directly

Test if the API is accessible:

```bash
curl http://127.0.0.1:2024/docs
```

If this works, the server is running correctly.

## ✅ Solution 6: Use Command Line Demo Instead

If Studio continues to have issues, use the command-line demo:

```bash
source venv/bin/activate
python run_demo.py
```

This works perfectly and shows the full workflow!

## 🎯 Quick Fix Commands

```bash
# Stop any running server (Ctrl+C)

# Start with tunnel (best for Safari)
source venv/bin/activate
langgraph dev --tunnel

# Or start normally (works for Chrome/Firefox)
langgraph dev
```

## 📝 Current Status

Your workflow is **fully functional** - this is just a browser connectivity issue. The command-line demo works perfectly!

