#!/bin/bash

# Quick setup script for LangGraph Finance Demo

echo "🧾 Setting up LangGraph Finance Demo..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env and add your Azure OpenAI credentials:"
    echo "     - AZURE_OPENAI_API_KEY"
    echo "     - AZURE_OPENAI_ENDPOINT"
    echo "     - AZURE_OPENAI_DEPLOYMENT"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add your Azure OpenAI credentials"
echo "  2. Run: python run_demo.py"
echo "  3. Or start LangGraph Studio: langgraph studio"
echo ""

