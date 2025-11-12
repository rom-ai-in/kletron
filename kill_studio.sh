#!/bin/bash

# Kill any existing LangGraph Studio server on port 2024

echo "🔍 Checking for LangGraph Studio server on port 2024..."

PID=$(lsof -ti:2024 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "🛑 Found process (PID: $PID), killing it..."
    kill -9 $PID
    sleep 1
    echo "✅ Port 2024 is now free"
else
    echo "✅ No process found on port 2024"
fi

