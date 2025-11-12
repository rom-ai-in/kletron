#!/bin/bash

# Start LangGraph Studio with tunnel (works with Safari/Brave)

echo "🚀 Starting LangGraph Studio with tunnel..."
echo ""

# Check if port 2024 is already in use
PID=$(lsof -ti:2024 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "⚠️  Port 2024 is already in use (PID: $PID)"
    echo "🛑 Killing existing process..."
    kill -9 $PID 2>/dev/null
    sleep 1
    echo "✅ Port cleared, starting fresh server..."
    echo ""
fi

echo "This will create a secure tunnel for browser access."
echo "Press Ctrl+C to stop"
echo ""

source venv/bin/activate
langgraph dev --tunnel

