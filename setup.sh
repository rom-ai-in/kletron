#!/bin/bash

set -euo pipefail

echo "🛠️  Setting up Numezis TS LangGraph"

if [ ! -f "package-lock.json" ]; then
  npm install
else
  npm install
fi

if [ ! -f ".env" ]; then
  cp env.example .env
  echo "⚠️  Please edit .env with your Azure OpenAI credentials and optional MCP_DEFAULT_DIR."
else
  echo "✅ .env already configured."
fi

echo ""
echo "Next steps:"
echo "  1. Set GITHUB_MCP_DEFAULT_DIR in .env to your target repo"
echo "  2. Start dev services (MCP + LangGraph dev): npm run dev"
echo "  3. Or run the interactive CLI: npm start"
echo ""
