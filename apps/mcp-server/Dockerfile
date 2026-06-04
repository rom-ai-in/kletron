# Build from repository root:
#   docker build -f apps/mcp-server/Dockerfile -t kletron-mcp .
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY packages/agent-core/package.json packages/agent-core/package.json
COPY packages/bridge/package.json packages/bridge/package.json
COPY packages/mcp-client/package.json packages/mcp-client/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --omit=dev --legacy-peer-deps

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV MCP_TRANSPORT=sse
ENV GITHUB_MCP_TRANSPORT=sse
ENV HOSTNAME=0.0.0.0

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY packages/shared ./packages/shared
COPY apps/mcp-server ./apps/mcp-server

WORKDIR /app/apps/mcp-server
EXPOSE 8080
CMD ["sh", "-c", "export MCP_PORT=\"${PORT:-8080}\" GITHUB_MCP_PORT=\"${PORT:-8080}\" && exec node server.js --mcp"]
