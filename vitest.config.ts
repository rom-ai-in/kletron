import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@numezis/shared': path.resolve(__dirname, 'packages/shared/src'),
            '@numezis/ui': path.resolve(__dirname, 'packages/ui/src'),
            '@numezis/server': path.resolve(__dirname, 'packages/server/src'),
            '@numezis/agent-core': path.resolve(__dirname, 'packages/agent-core/src'),
            '@numezis/mcp-client': path.resolve(__dirname, 'packages/mcp-client/src'),
        },
    },
    test: {
        environment: 'node',
        include: [
            'packages/**/__tests__/**/*.test.ts',
            'apps/**/__tests__/**/*.test.ts',
            'apps/mcp-server/tests/safety.test.js',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'apps/mcp-server/tests/tools.test.js',
            'apps/mcp-server/tests/mcpRegistration.test.js',
        ],
        coverage: {
            provider: 'v8',
        },
        globals: true,
    },
});
