# 🔧 Fix Studio Connection - Step by Step

## Current Issue
Studio can't connect to the API server through the tunnel.

## ✅ Solution Steps

### Step 1: Stop Everything
```bash
# Press Ctrl+C in the terminal where langgraph dev is running
# Or kill the process:
pkill -f "langgraph\|cloudflared"
```

### Step 2: Restart with Fresh Tunnel
```bash
source venv/bin/activate
langgraph dev --tunnel
```

### Step 3: Wait for Full Initialization
Wait until you see:
- ✅ `Registered tunnel connection`
- ✅ `Registering graph with id 'finance_analyzer'`
- ✅ `Server started`

### Step 4: Copy the EXACT Studio URL
Look for this line in the output:
```
🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=https://YOUR-TUNNEL-URL.trycloudflare.com
```

### Step 5: Test Tunnel First
Before opening Studio, test if tunnel works:
```bash
curl https://YOUR-TUNNEL-URL.trycloudflare.com/docs
```

If this returns HTML, the tunnel is working.

### Step 6: Open Studio URL
1. Copy the Studio URL from terminal
2. Open in Chrome (not Safari)
3. Wait for it to load (may take 30 seconds)

### Step 7: If Still Failing - Try Direct API
Test the API directly:
```bash
curl -X GET https://YOUR-TUNNEL-URL.trycloudflare.com/assistants
```

Should return JSON with your `finance_analyzer` assistant.

## 🔄 Alternative: Restart Everything Fresh

```bash
# 1. Kill all processes
pkill -f langgraph
pkill -f cloudflared

# 2. Wait 10 seconds

# 3. Start fresh
cd /Users/romainmagnin/Desktop/demo
source venv/bin/activate
langgraph dev --tunnel

# 4. Wait for tunnel URL
# 5. Copy Studio URL
# 6. Open in Chrome
```

## 🌐 Browser Tips

- **Use Chrome** - Most reliable
- **Disable extensions** - Some can block connections
- **Try incognito mode** - Rules out cache issues
- **Check console** - F12 → Console tab for errors

## ⚠️ If Tunnel Keeps Failing

The tunnel URL changes each time. Make sure you're using the LATEST URL from the terminal output.

