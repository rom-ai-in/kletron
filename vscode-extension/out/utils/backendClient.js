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
    async getHealth() {
        return this.fetchJson('/api/health');
    }
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
