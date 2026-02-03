import fetch, { type RequestInit } from 'node-fetch';
import type {
  AgentGraph,
  AgentGraphListResponse,
  AgentOutputMessage,
  ApplyDiffResponse,
  ContextConfig,
  DiffResponse,
  DirectoryListResponse,
  EmbeddingConfig,
  FileReadResponse,
  FileWriteResponse,
  FolderValidationResponse,
  HealthResponse,
  LlmConfig,
  RunAgentResponse,
  RunStatusResponse,
  StreamChunk,
  ToolsListResponse,
  WorkspaceConfig,
} from '../types/api';

export type { AgentOutputMessage, RunStatusResponse };

export interface LlmSettings {
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export class BackendClient {
  private baseUrl: string = '';
  private token: string = '';

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/*$/, '');
  }

  setToken(token: string) {
    this.token = token;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  hasBaseUrl(): boolean {
    return Boolean(this.baseUrl);
  }

  private getHeaders(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private assertConfigured() {
    if (!this.baseUrl) {
      throw new Error('Backend URL is not configured');
    }
  }

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const res = await fetch(`${this.baseUrl}${normalizedPath}`, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...this.getHeaders(),
      },
    });

    if (!res.ok) {
      const payload = await res.text();
      throw new Error(`Backend request failed (${res.status}): ${payload}`);
    }

    const data = await res.json();
    return data as T;
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Check if the current token is valid and return user info.
   * Returns null if not authenticated.
   */
  async checkAuth(): Promise<{ userId: string; email?: string } | null> {
    if (!this.baseUrl || !this.token) {
      return null;
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/me`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json() as { success: boolean; user?: { id: string; email?: string } };
      if (!data.success || !data.user) {
        return null;
      }
      return { userId: data.user.id, email: data.user.email };
    } catch {
      return null;
    }
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  // ============================================================================
  // Agent Run Operations
  // ============================================================================

  async runAgent(prompt: string, agentId: string, llm?: LlmSettings): Promise<RunAgentResponse> {
    return this.fetchJson<RunAgentResponse>('/api/agent/run', {
      method: 'POST',
      body: JSON.stringify({ prompt, agentId, llm }),
    });
  }

  async getRunStatus(runId: string): Promise<RunStatusResponse> {
    return this.fetchJson<RunStatusResponse>(`/api/agent/status/${runId}`);
  }

  async getDiff(runId: string): Promise<DiffResponse> {
    return this.fetchJson<DiffResponse>(`/api/agent/diff/${runId}`);
  }

  async applyDiff(runId: string, diff: string): Promise<ApplyDiffResponse> {
    return this.fetchJson<ApplyDiffResponse>(`/api/agent/apply/${runId}`, {
      method: 'POST',
      body: JSON.stringify({ diff }),
    });
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async readFile(path: string): Promise<FileReadResponse> {
    return this.fetchJson<FileReadResponse>('/api/editor/file/read', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  async writeFile(path: string, content: string): Promise<FileWriteResponse> {
    return this.fetchJson<FileWriteResponse>('/api/editor/file/write', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    });
  }

  async listDirectory(path: string = '.'): Promise<DirectoryListResponse> {
    const encoded = new URLSearchParams({ path }).toString();
    return this.fetchJson<DirectoryListResponse>(`/api/editor/file/tree?${encoded}`);
  }

  // ============================================================================
  // Health & Config
  // ============================================================================

  async getHealth(): Promise<HealthResponse> {
    return this.fetchJson<HealthResponse>('/api/health');
  }

  async getWorkspaceConfig(): Promise<WorkspaceConfig> {
    return this.fetchJson<WorkspaceConfig>('/api/config');
  }

  async saveWorkspaceConfig(config: { workingFolder: string }): Promise<WorkspaceConfig> {
    return this.fetchJson<WorkspaceConfig>('/api/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async validateFolder(path: string): Promise<FolderValidationResponse> {
    return this.fetchJson<FolderValidationResponse>('/api/validation/folder', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  async getContextConfig(): Promise<ContextConfig> {
    return this.fetchJson<ContextConfig>('/api/context-config');
  }

  async saveContextConfig(config: ContextConfig): Promise<ContextConfig> {
    return this.fetchJson<ContextConfig>('/api/context-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // ============================================================================
  // LLM Configuration
  // ============================================================================

  async getLlmConfig(): Promise<LlmConfig> {
    return this.fetchJson<LlmConfig>('/api/llm-config');
  }

  async setLlmProvider(provider: string): Promise<LlmConfig> {
    return this.fetchJson<LlmConfig>('/api/llm-config', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }

  async saveLlmAzure(config: Record<string, unknown>): Promise<LlmConfig> {
    return this.fetchJson<LlmConfig>('/api/llm-config/azure', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async saveLlmLmstudio(config: Record<string, unknown>): Promise<LlmConfig> {
    return this.fetchJson<LlmConfig>('/api/llm-config/lmstudio', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async resetLlm(): Promise<LlmConfig> {
    return this.fetchJson<LlmConfig>('/api/llm-config', {
      method: 'DELETE',
    });
  }

  async testLlmConfig(provider: string, config: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    return this.fetchJson<{ success: boolean; message?: string }>('/api/llm-config/test', {
      method: 'POST',
      body: JSON.stringify({ provider, config }),
    });
  }

  // ============================================================================
  // Embedding Configuration
  // ============================================================================

  async getEmbeddingConfig(): Promise<EmbeddingConfig> {
    return this.fetchJson<EmbeddingConfig>('/api/embedding-config');
  }

  async setEmbeddingProvider(provider: string): Promise<EmbeddingConfig> {
    return this.fetchJson<EmbeddingConfig>('/api/embedding-config', {
      method: 'PATCH',
      body: JSON.stringify({ provider }),
    });
  }

  async saveEmbeddingAzure(config: Record<string, unknown>): Promise<EmbeddingConfig> {
    return this.fetchJson<EmbeddingConfig>('/api/embedding-config/azure', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async saveEmbeddingLmstudio(config: Record<string, unknown>): Promise<EmbeddingConfig> {
    return this.fetchJson<EmbeddingConfig>('/api/embedding-config/lmstudio', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async resetEmbedding(): Promise<EmbeddingConfig> {
    return this.fetchJson<EmbeddingConfig>('/api/embedding-config', {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Agent Graphs
  // ============================================================================

  async listAgentGraphs(): Promise<AgentGraphListResponse> {
    return this.fetchJson<AgentGraphListResponse>('/api/agent-graphs');
  }

  async getAgentGraph(id: string): Promise<AgentGraph> {
    return this.fetchJson<AgentGraph>(`/api/agent-graphs/${id}`);
  }

  async updateAgentGraph(id: string, config: Partial<AgentGraph>): Promise<AgentGraph> {
    return this.fetchJson<AgentGraph>(`/api/agent-graphs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async deleteAgentGraph(id: string): Promise<{ deleted: boolean }> {
    return this.fetchJson<{ deleted: boolean }>(`/api/agent-graphs/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Tools
  // ============================================================================

  async getToolsList(): Promise<ToolsListResponse> {
    return this.fetchJson<ToolsListResponse>('/api/tools/list');
  }

  // ============================================================================
  // Streaming
  // ============================================================================

  async runAgentGraphStream(
    graphId: string,
    message: string,
    selection: { provider?: string; model?: string },
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    this.assertConfigured();
    const res = await fetch(`${this.baseUrl}/api/agent-graphs/${graphId}/stream`, {
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
    for await (const chunk of res.body as AsyncIterable<Buffer>) {
      buffer += chunk.toString('utf8');
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) {
          try {
            onChunk(JSON.parse(line) as StreamChunk);
          } catch {
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

  subscribeToRun(runId: string, onUpdate: (status: RunStatusResponse) => void): () => void {
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
      } catch (error) {
        onUpdate({
          status: 'failed',
          output: [
            {
              role: 'system',
              content: typeof error === 'string' ? error : (error as Error).message,
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
