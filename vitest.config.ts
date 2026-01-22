import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/__tests__/**/*.test.ts', 'github-mcp/tests/safety.test.js'],
        exclude: ['**/node_modules/**', '**/dist/**', 'github-mcp/tests/tools.test.js', 'github-mcp/tests/mcpRegistration.test.js'],
        coverage: {
            provider: 'v8',
        },
        globals: true,
    },
});
