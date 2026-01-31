import fetch, { type RequestInit } from 'node-fetch'

export interface AgentOutputMessage {
  role: 'assistant' | 'user' | 'system'
  content: string
}

export interface RunStatusResponse {
  status: string
  output?: AgentOutputMessage[]
}

export interface LlmSettings {
  provider?: string
  baseUrl?: string
  model?: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
}

export class BackendClient {
  private baseUrl: string = ''
  private token: string = ''

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/*$/, '')
  }

  setToken(token: string) {
    this.token = token
  }

  getBaseUrl() {
    return this.baseUrl
  }

  hasBaseUrl(): boolean {
    return Boolean(this.baseUrl)
  }

  private getHeaders(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  private assertConfigured() {
    if (!this.baseUrl) {
      throw new Error('Backend URL is not configured')
    }
  }

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    this.assertConfigured()
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const res = await fetch(`${this.baseUrl}${normalizedPath}`, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...this.getHeaders(),
      },
    })

    if (!res.ok) {
      const payload = await res.text()
      throw new Error(`Backend request failed (${res.status}): ${payload}`)
    }

    const data = await res.json()
    return data as T
  }

  async runAgent(prompt: string, agentId: string, llm?: LlmSettings) {
    return this.fetchJson<{ runId: string; status: string }>('/api/agent/run', {
      method: 'POST',
      body: JSON.stringify({ prompt, agentId, llm }),
    })
  }

  async getRunStatus(runId: string) {
    return this.fetchJson<RunStatusResponse>(`/api/agent/status/${runId}`)
  }

  async getDiff(runId: string) {
    return this.fetchJson<{ diffHunk: string }>(`/api/agent/diff/${runId}`)
  }

  async applyDiff(runId: string, diff: string) {
    return this.fetchJson<{ status: string }>(`/api/agent/apply/${runId}`, {
      method: 'POST',
      body: JSON.stringify({ diff }),
    })
  }

  async readFile(path: string) {
    return this.fetchJson<{ content: string; path: string }>('/api/editor/file/read', {
      method: 'POST',
      body: JSON.stringify({ path }),
    })
  }

  async writeFile(path: string, content: string) {
    return this.fetchJson<{ ok: boolean; path: string }>('/api/editor/file/write', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    })
  }

  async listDirectory(path: string = '.') {
    const encoded = new URLSearchParams({ path }).toString()
    return this.fetchJson<{
      path: string
      entries: { name: string; isDirectory: boolean }[]
    }>(`/api/editor/file/tree?${encoded}`)
  }

  async getHealth() {
    return this.fetchJson<{ ok: boolean }>('/api/health')
  }

  async getWorkspaceConfig() {
    return this.fetchJson<any>('/api/config')
  }

  async getLlmConfig() {
    return this.fetchJson<any>('/api/llm-config')
  }

  async getEmbeddingConfig() {
    return this.fetchJson<any>('/api/embedding-config')
  }

  async testLlmConfig(provider: string, config: Record<string, unknown>) {
    return this.fetchJson<any>('/api/llm-config/test', {
      method: 'POST',
      body: JSON.stringify({ provider, config }),
    })
  }

  async listAgentGraphs() {
    return this.fetchJson<{ graphs: any[] }>('/api/agent-graphs')
  }

  async runAgentGraphStream(
    graphId: string,
    message: string,
    selection: { provider?: string; model?: string },
    onChunk: (chunk: any) => void
  ) {
    this.assertConfigured()
    const res = await fetch(`${this.baseUrl}/api/agent-graphs/${graphId}/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        message,
        provider: selection.provider,
        model: selection.model,
      }),
    })

    if (!res.ok || !res.body) {
      const payload = await res.text()
      throw new Error(`Graph stream failed (${res.status}): ${payload}`)
    }

    let buffer = ''
    for await (const chunk of res.body as any) {
      buffer += chunk.toString('utf8')
      let index = buffer.indexOf('\n')
      while (index !== -1) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line) {
          try {
            onChunk(JSON.parse(line))
          } catch {
            onChunk({ type: 'error', payload: { message: line } })
          }
        }
        index = buffer.indexOf('\n')
      }
    }
  }

  subscribeToRun(runId: string, onUpdate: (status: RunStatusResponse) => void) {
    let cancelled = false

    const poll = async () => {
      if (cancelled) {
        return
      }

      try {
        const status = await this.getRunStatus(runId)
        onUpdate(status)

        if (['completed', 'failed', 'errored'].includes(status.status)) {
          cancelled = true
          return
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
        })
        cancelled = true
        return
      }

      setTimeout(poll, 1500)
    }

    void poll()
    return () => {
      cancelled = true
    }
  }
}
