"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class BackendClient {
    constructor() {
        this.baseUrl = '';
        this.token = '';
    }
    setBaseUrl(url) {
        this.baseUrl = url.replace(/\/*$/, '');
    }
    setToken(token) {
        this.token = token;
    }
    getBaseUrl() {
        return this.baseUrl;
    }
    hasBaseUrl() {
        return Boolean(this.baseUrl);
    }
    getHeaders(extra = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...extra,
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
    assertConfigured() {
        if (!this.baseUrl) {
            throw new Error('Backend URL is not configured');
        }
    }
    async fetchJson(path, options = {}) {
        this.assertConfigured();
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const res = await (0, node_fetch_1.default)(`${this.baseUrl}${normalizedPath}`, {
            ...options,
            headers: {
                ...options.headers,
                ...this.getHeaders(),
            },
        });
        if (!res.ok) {
            const payload = await res.text();
            throw new Error(`Backend request failed (${res.status}): ${payload}`);
        }
        const data = await res.json();
        return data;
    }
    // ============================================================================
    // Authentication
    // ============================================================================
    /**
     * Check if the current token is valid and return user info.
     * Returns null if not authenticated.
     */
    async checkAuth() {
        if (!this.baseUrl || !this.token) {
            return null;
        }
        try {
            const res = await (0, node_fetch_1.default)(`${this.baseUrl}/api/auth/me`, {
                headers: this.getHeaders(),
            });
            if (!res.ok) {
                return null;
            }
            const data = await res.json();
            if (!data.success || !data.user) {
                return null;
            }
            return { userId: data.user.id, email: data.user.email };
        }
        catch {
            return null;
        }
    }
    hasToken() {
        return Boolean(this.token);
    }
    // ============================================================================
    // Agent Run Operations
    // ============================================================================
    async runAgent(prompt, agentId, llm) {
        return this.fetchJson('/api/agent/run', {
            method: 'POST',
            body: JSON.stringify({ prompt, agentId, llm }),
        });
    }
    async getRunStatus(runId) {
        return this.fetchJson(`/api/agent/status/${runId}`);
    }
    async getDiff(runId) {
        return this.fetchJson(`/api/agent/diff/${runId}`);
    }
    async applyDiff(runId, diff) {
        return this.fetchJson(`/api/agent/apply/${runId}`, {
            method: 'POST',
            body: JSON.stringify({ diff }),
        });
    }
    // ============================================================================
    // File Operations
    // ============================================================================
    async readFile(path) {
        return this.fetchJson('/api/editor/file/read', {
            method: 'POST',
            body: JSON.stringify({ path }),
        });
    }
    async writeFile(path, content) {
        return this.fetchJson('/api/editor/file/write', {
            method: 'POST',
            body: JSON.stringify({ path, content }),
        });
    }
    async listDirectory(path = '.') {
        const encoded = new URLSearchParams({ path }).toString();
        return this.fetchJson(`/api/editor/file/tree?${encoded}`);
    }
    // ============================================================================
    // Health & Config
    // ============================================================================
    async getHealth() {
        return this.fetchJson('/api/health');
    }
    async getWorkspaceConfig() {
        return this.fetchJson('/api/config');
    }
    async saveWorkspaceConfig(config) {
        return this.fetchJson('/api/config', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }
    async validateFolder(path) {
        return this.fetchJson('/api/validation/folder', {
            method: 'POST',
            body: JSON.stringify({ path }),
        });
    }
    async getContextConfig() {
        return this.fetchJson('/api/context-config');
    }
    async saveContextConfig(config) {
        return this.fetchJson('/api/context-config', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }
    // ============================================================================
    // LLM Configuration
    // ============================================================================
    async getLlmConfig() {
        return this.fetchJson('/api/llm-config');
    }
    async setLlmProvider(provider) {
        return this.fetchJson('/api/llm-config', {
            method: 'POST',
            body: JSON.stringify({ provider }),
        });
    }
    async saveLlmAzure(config) {
        return this.fetchJson('/api/llm-config/azure', {
            method: 'PUT',
            body: JSON.stringify(config),
        });
    }
    async saveLlmLmstudio(config) {
        return this.fetchJson('/api/llm-config/lmstudio', {
            method: 'PUT',
            body: JSON.stringify(config),
        });
    }
    async resetLlm() {
        return this.fetchJson('/api/llm-config', {
            method: 'DELETE',
        });
    }
    async testLlmConfig(provider, config) {
        return this.fetchJson('/api/llm-config/test', {
            method: 'POST',
            body: JSON.stringify({ provider, config }),
        });
    }
    // ============================================================================
    // Embedding Configuration
    // ============================================================================
    async getEmbeddingConfig() {
        return this.fetchJson('/api/embedding-config');
    }
    async setEmbeddingProvider(provider) {
        return this.fetchJson('/api/embedding-config', {
            method: 'PATCH',
            body: JSON.stringify({ provider }),
        });
    }
    async saveEmbeddingAzure(config) {
        return this.fetchJson('/api/embedding-config/azure', {
            method: 'PUT',
            body: JSON.stringify(config),
        });
    }
    async saveEmbeddingLmstudio(config) {
        return this.fetchJson('/api/embedding-config/lmstudio', {
            method: 'PUT',
            body: JSON.stringify(config),
        });
    }
    async resetEmbedding() {
        return this.fetchJson('/api/embedding-config', {
            method: 'DELETE',
        });
    }
    // ============================================================================
    // Agent Graphs
    // ============================================================================
    async listAgentGraphs() {
        return this.fetchJson('/api/agent-graphs');
    }
    async getAgentGraph(id) {
        return this.fetchJson(`/api/agent-graphs/${id}`);
    }
    async updateAgentGraph(id, config) {
        return this.fetchJson(`/api/agent-graphs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(config),
        });
    }
    async deleteAgentGraph(id) {
        return this.fetchJson(`/api/agent-graphs/${id}`, {
            method: 'DELETE',
        });
    }
    // ============================================================================
    // Tools
    // ============================================================================
    async getToolsList() {
        return this.fetchJson('/api/tools/list');
    }
    // ============================================================================
    // Streaming
    // ============================================================================
    async runAgentGraphStream(graphId, message, selection, onChunk) {
        this.assertConfigured();
        const res = await (0, node_fetch_1.default)(`${this.baseUrl}/api/agent-graphs/${graphId}/stream`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                message,
                provider: selection.provider,
                model: selection.model,
            }),
        });
        if (!res.ok || !res.body) {
            const payload = await res.text();
            throw new Error(`Graph stream failed (${res.status}): ${payload}`);
        }
        let buffer = '';
        for await (const chunk of res.body) {
            buffer += chunk.toString('utf8');
            let index = buffer.indexOf('\n');
            while (index !== -1) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                if (line) {
                    try {
                        onChunk(JSON.parse(line));
                    }
                    catch {
                        onChunk({ type: 'error', payload: { message: line } });
                    }
                }
                index = buffer.indexOf('\n');
            }
        }
    }
    // ============================================================================
    // Subscriptions (Polling)
    // ============================================================================
    subscribeToRun(runId, onUpdate) {
        let cancelled = false;
        const poll = async () => {
            if (cancelled) {
                return;
            }
            try {
                const status = await this.getRunStatus(runId);
                onUpdate(status);
                if (['completed', 'failed', 'errored'].includes(status.status)) {
                    cancelled = true;
                    return;
                }
            }
            catch (error) {
                onUpdate({
                    status: 'failed',
                    output: [
                        {
                            role: 'system',
                            content: typeof error === 'string' ? error : error.message,
                        },
                    ],
                });
                cancelled = true;
                return;
            }
            setTimeout(poll, 1500);
        };
        void poll();
        return () => {
            cancelled = true;
        };
    }
}
exports.BackendClient = BackendClient;
