#!/bin/bash

# Script to kill existing LangGraph Studio server and restart it

echo "🔍 Checking for existing LangGraph Studio server on port 2024..."

# Find and kill process on port 2024
PID=$(lsof -ti:2024)
if [ ! -z "$PID" ]; then
    echo "🛑 Killing existing process (PID: $PID)..."
    kill -9 $PID
    sleep 1
    echo "✅ Port 2024 cleared"
else
    echo "✅ Port 2024 is free"
fi

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run setup.sh first."
    exit 1
fi

source venv/bin/activate

# Start LangGraph Studio
echo "🚀 Starting LangGraph Studio..."
langgraph dev
