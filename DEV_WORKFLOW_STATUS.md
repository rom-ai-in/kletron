# Dev Workflow Status

## Services Running

### ✅ MCP Server
- **Port**: 9000
- **Status**: Healthy
- **Tools Available**: 29
- **Transport**: SSE (Server-Sent Events)
- **Default Directory**: /Users/romainmagnin/Desktop/numezis

### ✅ LangGraph Dev Server
- **Port**: 8080
- **Version**: 1.1.11
- **LangGraph JS Version**: 1.1.3
- **Features**: Assistants enabled, LangSmith tracing enabled
- **Context**: JavaScript runtime

### ✅ Web UI (Next.js)
- **Port**: 3000
- **Status**: Running
- **URL**: http://localhost:3000
- **Application**: Kletron web interface with authentication and agent dashboard

### ✅ Electron Desktop App
- **Status**: Running
- **Main Process**: Active
- **Renderer Processes**: Multiple (for different windows)
- **GPU Process**: Active
- **Network Service**: Active

### ✅ Drift Analysis Worker
- **Status**: Running
- **Function**: Background analysis of code changes and repository state
- **Database**: Connected

### ✅ Terminal Worker
- **Status**: Running
- **Function**: Terminal operations and shell command execution

## Health Checks Passed

All required services have passed health checks:
- MCP Server health endpoint: ✅
- LangGraph info endpoint: ✅  
- Web UI readiness: ✅

## Access Points

### Web Interface
Open your browser to: http://localhost:3000

### API Endpoints
- **MCP API**: http://localhost:9000
- **LangGraph API**: http://localhost:8080
- **Web API**: http://localhost:3000/api

### LangSmith Studio
For graph visualization and debugging:
https://smith.langchain.com/studio?baseUrl=http://localhost:8080

## Development Workflow

The dev workflow includes:
1. MCP server for tool integration
2. LangGraph development server with hot reloading
3. Next.js web application with React components
4. Electron desktop app with native integrations
5. Background workers for analysis and monitoring
6. Terminal worker for shell operations

## Troubleshooting

If any service fails:
1. Check the logs in /tmp/dev-output.log
2. Verify all dependencies are installed (npm install)
3. Ensure no port conflicts exist
4. Restart the dev workflow with: npm run dev
