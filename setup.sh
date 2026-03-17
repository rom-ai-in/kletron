#!/bin/bash

set -euo pipefail

echo "🛠️  Setting up Kletron"

if [ ! -f "package-lock.json" ]; then
  npm install
else
  npm install
fi

if [ ! -f ".env" ]; then
  cp env.example .env
  echo "⚠️  Please edit .env with your Azure OpenAI credentials."
else
  echo "✅ .env already configured."
fi

echo ""
echo "Next steps:"
echo "  1. Set the repository in Configuration > Repository Settings (writes config/config.json)"
echo "  2. Start dev services (MCP + LangGraph dev): npm run dev"
echo "  3. Or run the interactive CLI: npm start"
echo ""
