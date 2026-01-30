import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/__tests__/**/*.test.ts', 'mcp-server/tests/safety.test.js'],
        exclude: ['**/node_modules/**', '**/dist/**', 'mcp-server/tests/tools.test.js', 'mcp-server/tests/mcpRegistration.test.js'],
        coverage: {
            provider: 'v8',
        },
        globals: true,
    },
});
