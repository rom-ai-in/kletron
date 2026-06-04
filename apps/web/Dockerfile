# Build from repository root:
#   docker build -f apps/web/Dockerfile -t kletron-web .
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
RUN npm ci --legacy-peer-deps

FROM deps AS builder
WORKDIR /app
COPY . .
# Next.js evaluates modules that require MONGODB_URI during build; runtime uses Cloud Run secrets.
ARG MONGODB_URI_BUILD=mongodb://127.0.0.1:27017/next-build-placeholder
ENV MONGODB_URI=${MONGODB_URI_BUILD}
# Inlined at build time for Next.js client bundles; override via Cloud Build --build-arg
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN npm run build:web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run sets PORT; Next standalone respects it
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Standalone file tracing omits bcrypt native prebuilds (.node); without them every route that loads bcrypt returns 500 HTML.
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
