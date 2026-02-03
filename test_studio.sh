#!/bin/bash

# Quick test script for LangGraph Studio

echo "🧾 LangGraph Studio Test Script"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "   Creating from env.example..."
    cp env.example .env
    echo "   ⚠️  Please edit .env and add your Azure OpenAI credentials!"
    echo ""
    read -p "Press Enter after you've added your credentials to .env..."
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

# Install langgraph-studio if not already installed
echo "📥 Installing LangGraph Studio..."
pip install -q langgraph-studio 2>/dev/null || pip install -q langgraph[studio]

# Check if sample CSV exists
if [ ! -f "sample_financials.csv" ]; then
    echo "⚠️  sample_financials.csv not found!"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Starting LangGraph Studio..."
echo "   Studio will open at: http://localhost:2024"
echo "   Press Ctrl+C to stop"
echo ""

# Start LangGraph dev server (connects to web-based Studio)
echo ""
echo "📝 LangGraph Studio is web-based."
echo "   The dev server will start and show you a URL"
echo "   Open that URL to access Studio"
echo ""
echo "🚀 Starting LangGraph dev server..."
echo "   Press Ctrl+C to stop"
echo ""
langgraph dev
