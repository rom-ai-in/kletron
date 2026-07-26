import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@kletron/shared': path.resolve(__dirname, 'packages/shared/src'),
            '@kletron/ui': path.resolve(__dirname, 'packages/ui/src'),
            '@kletron/server': path.resolve(__dirname, 'packages/server/src'),
            '@kletron/agent-core': path.resolve(__dirname, 'packages/agent-core/src'),
            '@kletron/mcp-client': path.resolve(__dirname, 'packages/mcp-client/src'),
            '@kletron/codex-bridge': path.resolve(__dirname, 'packages/codex-bridge/src'),
        },
    },
    test: {
        environment: 'node',
        include: [
            'packages/**/__tests__/**/*.test.ts',
            'packages/**/tests/**/*.test.ts',
            'apps/**/__tests__/**/*.test.ts',
            'apps/mcp-server/tests/safety.test.js',
            'apps/mcp-server/tests/httpAuth.test.js',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            // Next.js copies test files into its standalone build output; collecting
            // them re-runs every suite against stale, unresolvable build artifacts.
            '**/.next/**',
            'apps/mcp-server/tests/tools.test.js',
            'apps/mcp-server/tests/mcpRegistration.test.js',
            // Run with `npx tsx --test <file>` — Vitest does not collect `node:test` suites.
            'packages/server/__tests__/agentGraphExecutorGuards.test.ts',
            'packages/server/__tests__/replayImpact.test.ts',
            'packages/server/__tests__/channelStoreService.test.ts',
            'packages/server/__tests__/executeBash.integration.test.ts',
            'packages/server/__tests__/channelSlashParse.test.ts',
            'packages/server/__tests__/checkpointService.test.ts',
            'packages/server/__tests__/channelSecretsCrypto.test.ts',
        ],
        coverage: {
            provider: 'v8',
        },
        globals: true,
    },
});
