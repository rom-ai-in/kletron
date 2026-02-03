"use strict";
/**
 * Numezis Code Webview Application
 *
 * This module handles all webview-side logic including:
 * - State management
 * - UI rendering
 * - Event handling
 * - VS Code API communication
 */
// Initialize VS Code API
const vscode = acquireVsCodeApi();
// Application state
const state = {
    runs: [],
    selectedRunId: undefined,
    connected: false,
    isAuthenticated: false,
    userEmail: undefined,
    backendUrl: '',
    apiToken: '',
    llm: { provider: '', baseUrl: '', model: '', apiKey: '', temperature: 0.2, maxTokens: 0 },
    graphs: [],
    selectedGraphId: '',
    llmConfig: undefined,
    embeddingConfig: undefined,
    workspaceConfig: undefined,
    contextConfig: undefined,
    toolsList: [],
    graphDetail: undefined,
    llmSelection: { provider: '', model: '' },
    activePage: 'chat',
};
// ============================================================================
// Utility Functions
// ============================================================================
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function truncate(value, max = 8) {
    const str = String(value || '');
    if (str.length <= max)
        return str;
    return str.slice(0, max - 1) + '…';
}
function getProviders() {
    if (!state.llmConfig)
        return [];
    const providers = [];
    if (state.llmConfig.azure)
        providers.push('azure');
    if (state.llmConfig.lmstudio)
        providers.push('lmstudio');
    return providers;
}
function getSelectedProvider() {
    return state.llmSelection.provider || state.llm.provider || '';
}
function getSelectedModel() {
    return state.llmSelection.model || state.llm.model || '';
}
function statusTone(status) {
    const value = (status || '').toString().toLowerCase();
    if (value === 'completed' || value === 'success')
        return 'success';
    if (value === 'failed' || value === 'errored' || value === 'error')
        return 'danger';
    if (value === 'cancelled' || value === 'canceled' || value === 'stopped')
        return 'warning';
    if (value === 'running' || value === 'pending' || value === 'in_progress')
        return 'info';
    return 'muted';
}
function isRunning() {
    const selected = state.runs.find((run) => run.runId === state.selectedRunId);
    if (!selected)
        return false;
    return ['running', 'pending', 'in_progress'].includes((selected.status || '').toLowerCase());
}
// ============================================================================
// Icon Templates (EXACT Match from lucide-react as used in Design System)
// ============================================================================
const icons = {
    // MessageSquare - Chat tab
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    // List - Runs tab
    runs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    // Settings
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    // RefreshCw - Reload
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    // Check
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    // Save
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    // RotateCcw - Reset
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    // Trash2 - Delete
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    // Plus
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    // BarChart3 - Agent/Graph selector
    graph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    // Cpu - LLM selector
    llm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
    // ArrowUp - Send
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    // Square - Stop
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
    // User
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    // X - Close/Reject
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    // ChevronDown
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    // ChevronRight
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
};
// ============================================================================
// Render Functions
// ============================================================================
function renderMessages() {
    const selected = state.runs.find((run) => run.runId === state.selectedRunId);
    const messages = (selected === null || selected === void 0 ? void 0 : selected.output) || [];
    if (!messages.length) {
        return '<div class="muted">No messages yet.</div>';
    }
    return messages.map((message) => `
    <div class="message">
      <div class="meta ${escapeHtml(message.role)}">${escapeHtml(message.role)}</div>
      <div>${escapeHtml(message.content)}</div>
    </div>
  `).join('');
}
function renderProviderOptions() {
    const providers = getProviders();
    if (!providers.length) {
        return '<option value="">default</option>';
    }
    return providers.map((provider) => {
        const selected = provider === getSelectedProvider() ? 'selected' : '';
        // Get model from the correct config based on provider
        let model = '';
        if (state.llmConfig) {
            const activeProvider = state.llmConfig.provider || 'azure';
            if (activeProvider === 'azure' && state.llmConfig.azure) {
                model = state.llmConfig.azure.model || state.llmConfig.azure.deployment || '';
            }
            else if (activeProvider === 'lmstudio' && state.llmConfig.lmstudio) {
                model = state.llmConfig.lmstudio.model || '';
            }
        }
        // Fallback to legacy properties
        if (!model) {
            model = state.llmSelection.model || state.llm.model || '';
        }
        const label = model ? truncate(model, 12) : provider;
        return `<option value="${provider}" ${selected}>${escapeHtml(label)}</option>`;
    }).join('');
}
function renderGraphOptions() {
    if (!state.graphs.length) {
        return '<option value="">No graphs</option>';
    }
    return state.graphs.map((graph) => {
        const id = graph._id || graph.id || '';
        const name = graph.name || id;
        const selected = id === state.selectedGraphId ? 'selected' : '';
        return `<option value="${id}" ${selected}>${escapeHtml(truncate(name, 8))}</option>`;
    }).join('');
}
function renderRunItems() {
    if (!state.runs.length) {
        return '<div class="muted">No runs yet.</div>';
    }
    return state.runs.map((run) => {
        const activeClass = run.runId === state.selectedRunId ? 'active' : '';
        const tone = statusTone(run.status);
        return `
      <button class="run-row ${activeClass}" data-run="${run.runId}">
        <div>
          <div class="run-title">${escapeHtml(run.prompt || 'Untitled run')}</div>
          <div class="run-meta">${escapeHtml(run.agentId || '')}</div>
        </div>
        <span class="status-tag status-${tone}">${escapeHtml(run.status || 'unknown')}</span>
      </button>
    `;
    }).join('');
}
function renderConnectBanner() {
    // When authenticated - return empty (we show user icon in topbar now)
    if (state.connected && state.isAuthenticated) {
        return '';
    }
    // Show modern welcome screen when connected but not authenticated
    if (state.connected && !state.isAuthenticated) {
        return `
      <div class="welcome-screen">
        <div class="welcome-logo">
          <span>🧠</span>
        </div>
        <h2 class="welcome-title">Welcome back</h2>
        <p class="welcome-subtitle">Sign in to connect VS Code</p>
        <button class="primary-btn" id="loginBtn">Sign In</button>
      </div>
    `;
    }
    // Show connection form when not connected
    return `
    <div class="welcome-screen">
      <div class="welcome-logo">
        <span>🧠</span>
      </div>
      <h2 class="welcome-title">Connect to Numezis</h2>
      <p class="welcome-subtitle">Enter your backend URL to get started</p>
      <div class="connect-form">
        <div class="form-group">
          <label class="form-label">Backend URL</label>
          <input id="backendUrl" class="form-input" placeholder="https://your-backend.com" value="${escapeHtml(state.backendUrl || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">API Token</label>
          <input id="apiToken" class="form-input" placeholder="Optional" type="password" value="${escapeHtml(state.apiToken || '')}" />
        </div>
        <button class="primary-btn" id="saveConnection">Connect</button>
      </div>
    </div>
  `;
}
function renderSettingsPage() {
    var _a, _b, _c, _d, _e;
    const workspacePath = ((_a = state.workspaceConfig) === null || _a === void 0 ? void 0 : _a.workingFolder) || '';
    const contextJson = state.contextConfig ? JSON.stringify(state.contextConfig, null, 2) : '';
    const azureJson = ((_b = state.llmConfig) === null || _b === void 0 ? void 0 : _b.azure) ? JSON.stringify(state.llmConfig.azure, null, 2) : '';
    const lmstudioJson = ((_c = state.llmConfig) === null || _c === void 0 ? void 0 : _c.lmstudio) ? JSON.stringify(state.llmConfig.lmstudio, null, 2) : '';
    const graphJson = state.graphDetail ? JSON.stringify(state.graphDetail, null, 2) : '';
    // Auth-gated sections
    const authGatedSections = state.isAuthenticated ? `
    <div class="setting-group">
      <div class="section-title">LLM Provider</div>
      <select id="llmProviderSetting" class="form-input">
        <option value="azure" ${((_d = state.llmConfig) === null || _d === void 0 ? void 0 : _d.provider) === 'azure' ? 'selected' : ''}>Azure OpenAI</option>
        <option value="lmstudio" ${((_e = state.llmConfig) === null || _e === void 0 ? void 0 : _e.provider) === 'lmstudio' ? 'selected' : ''}>LM Studio</option>
      </select>
    </div>
    <div class="setting-group">
      <div class="section-title">Azure Config</div>
      <textarea id="llmAzure" class="form-input">${escapeHtml(azureJson)}</textarea>
    </div>
    <div class="setting-group">
      <div class="section-title">LM Studio Config</div>
      <textarea id="llmLmstudio" class="form-input">${escapeHtml(lmstudioJson)}</textarea>
    </div>
    <div class="settings-row">
      <button class="icon-btn" id="saveLlmProvider" title="Set provider">${icons.check}</button>
      <button class="icon-btn" id="saveLlmAzure" title="Save Azure">${icons.save}</button>
      <button class="icon-btn" id="saveLlmLmstudio" title="Save LM Studio">${icons.save}</button>
      <button class="icon-btn" id="resetLlm" title="Reset">${icons.reset}</button>
    </div>
    <div class="setting-group">
      <div class="section-title">Agent Graph</div>
      <select id="graphPicker" class="form-input">${renderGraphOptions()}</select>
    </div>
    <div class="setting-group">
      <div class="section-title">Graph JSON</div>
      <textarea id="graphJson" class="form-input">${escapeHtml(graphJson)}</textarea>
    </div>
    <div class="settings-row">
      <button class="icon-btn" id="saveGraph" title="Save graph">${icons.save}</button>
      <button class="icon-btn" id="deleteGraph" title="Delete graph">${icons.delete}</button>
    </div>
    ` : `
    <div class="setting-group">
      <div class="section-title">Authentication Required</div>
      <div class="muted">Sign in to access LLM, embedding, and graph settings.</div>
    </div>
    `;
    return `
    <div class="setting-group">
      <div class="section-title">Workspace</div>
      <input id="workspacePath" class="form-input" value="${escapeHtml(workspacePath)}" placeholder="/path/to/project" />
    </div>
    <div class="settings-row">
      <button class="icon-btn" id="validateWorkspace" title="Validate">${icons.check}</button>
      <button class="icon-btn" id="saveWorkspace" title="Save">${icons.save}</button>
    </div>
    <div class="setting-group">
      <div class="section-title">Context Config</div>
      <textarea id="contextConfig" class="form-input">${escapeHtml(contextJson)}</textarea>
    </div>
    <div class="settings-row">
      <button class="icon-btn" id="saveContext" title="Save">${icons.save}</button>
    </div>
    ${authGatedSections}
  `;
}
function render() {
    const root = document.getElementById('root');
    if (!root)
        return;
    const running = isRunning();
    const html = `
    <div class="root">
      <div class="topbar">
        <div class="tab-group">
          <button class="icon-btn ${state.activePage === 'chat' ? 'active' : ''}" data-page="chat" title="Chat">${icons.chat}</button>
          <button class="icon-btn ${state.activePage === 'runs' ? 'active' : ''}" data-page="runs" title="Runs">${icons.runs}</button>
          <button class="icon-btn ${state.activePage === 'settings' ? 'active' : ''}" data-page="settings" title="Settings">${icons.settings}</button>
        </div>
        <div class="tab-group">
          <button class="icon-btn" id="reloadConfig" title="Reload">${icons.reload}</button>
          ${state.isAuthenticated ? `<button class="icon-btn user-btn" id="openAccountBtn" title="${escapeHtml(state.userEmail || 'Account')}">${icons.user}</button>` : ''}
        </div>
      </div>
      <div class="page ${state.activePage === 'chat' ? 'active' : ''}">
        <div class="content">
          ${renderConnectBanner()}
          ${state.isAuthenticated ? `<div class="messages">${renderMessages()}</div>` : ''}
        </div>
        ${state.isAuthenticated ? `
        <div class="composer">
          <div class="composer-inner">
            <textarea id="promptInput" placeholder="Ask anything..." rows="1"></textarea>
            <div class="composer-row">
              <div class="tab-group">
                <div class="chip-group" title="Agent Graph">
                  ${icons.graph}
                  <select id="graphSelect" class="chip-select">${renderGraphOptions()}</select>
                </div>
                <div class="chip-group" title="LLM">
                  ${icons.llm}
                  <select id="llmProviderSelect" class="chip-select">${renderProviderOptions()}</select>
                </div>
              </div>
              <button class="btn ${running ? 'stop' : ''}" id="sendBtn">
                ${running ? icons.stop : icons.send}
              </button>
            </div>


          </div>
        </div>
        ` : ''}
      </div>
      <div class="page ${state.activePage === 'runs' ? 'active' : ''}">
        <div class="content">
          <div class="runs-list">${renderRunItems()}</div>
        </div>
      </div>
      <div class="page ${state.activePage === 'settings' ? 'active' : ''}">
        <div class="content">
          ${renderSettingsPage()}
        </div>
      </div>
    </div>
  `;
    root.innerHTML = html;
    attachEventListeners();
    // Scroll messages to bottom
    const messagesEl = root.querySelector('.messages');
    if (messagesEl)
        messagesEl.scrollTop = messagesEl.scrollHeight;
}
// ============================================================================
// Event Handlers
// ============================================================================
function attachEventListeners() {
    const root = document.getElementById('root');
    if (!root)
        return;
    // Page navigation
    root.querySelectorAll('.icon-btn[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.activePage = btn.dataset.page;
            render();
        });
    });
    // Run selection
    root.querySelectorAll('.run-row').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.selectedRunId = btn.dataset.run;
            vscode.postMessage({ type: 'selectRun', runId: state.selectedRunId });
            state.activePage = 'chat';
            render();
        });
    });
    // Send/Stop button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            var _a;
            if (!state.connected)
                return;
            if (isRunning()) {
                vscode.postMessage({ type: 'stopRun', runId: state.selectedRunId || undefined });
                return;
            }
            const promptEl = document.getElementById('promptInput');
            const prompt = ((_a = promptEl === null || promptEl === void 0 ? void 0 : promptEl.value) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            if (!prompt)
                return;
            vscode.postMessage({ type: 'run', prompt, agentId: 'agent-001' });
            if (promptEl)
                promptEl.value = '';
        });
    }
    // Enter to send
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
        // Auto-resize textarea as user types (max 6 lines)
        const autoResize = () => {
            promptInput.style.height = 'auto';
            const maxHeight = 120; // ~6 lines
            promptInput.style.height = Math.min(promptInput.scrollHeight, maxHeight) + 'px';
        };
        promptInput.addEventListener('input', autoResize);
        // Enter to send (Shift+Enter for newline)
        promptInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendBtn === null || sendBtn === void 0 ? void 0 : sendBtn.click();
                // Reset height after sending
                promptInput.style.height = 'auto';
            }
        });
    }
    // Connection
    const saveConnectionBtn = document.getElementById('saveConnection');
    if (saveConnectionBtn) {
        saveConnectionBtn.addEventListener('click', () => {
            var _a, _b, _c, _d;
            const backendUrl = ((_b = (_a = document.getElementById('backendUrl')) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.trim()) || '';
            const apiToken = ((_d = (_c = document.getElementById('apiToken')) === null || _c === void 0 ? void 0 : _c.value) === null || _d === void 0 ? void 0 : _d.trim()) || '';
            vscode.postMessage({ type: 'updateSettings', settings: { backendUrl, apiToken, llm: state.llm } });
        });
    }
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'login' });
        });
    }
    // Reload config
    const reloadBtn = document.getElementById('reloadConfig');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => vscode.postMessage({ type: 'loadConfig' }));
    }
    // Open account page
    const accountBtn = document.getElementById('openAccountBtn');
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openAccount' });
        });
    }
    // Graph selection
    const graphSelect = document.getElementById('graphSelect');
    if (graphSelect) {
        graphSelect.addEventListener('change', () => {
            state.selectedGraphId = graphSelect.value;
            vscode.postMessage({ type: 'selectGraph', graphId: state.selectedGraphId });
        });
    }
    // LLM provider selection
    const providerSelect = document.getElementById('llmProviderSelect');
    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            state.llmSelection.provider = providerSelect.value;
            vscode.postMessage({ type: 'setLlmSelection', provider: state.llmSelection.provider, model: getSelectedModel() });
        });
    }
    // Settings handlers
    attachSettingsListeners();
}
function attachSettingsListeners() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    // Workspace
    (_a = document.getElementById('validateWorkspace')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
        var _a, _b;
        const path = ((_b = (_a = document.getElementById('workspacePath')) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.trim()) || '';
        vscode.postMessage({ type: 'validateWorkspace', path });
    });
    (_b = document.getElementById('saveWorkspace')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
        var _a, _b;
        const workingFolder = ((_b = (_a = document.getElementById('workspacePath')) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.trim()) || '';
        vscode.postMessage({ type: 'saveWorkspace', config: { workingFolder } });
    });
    // Context
    (_c = document.getElementById('saveContext')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
        var _a;
        const config = ((_a = document.getElementById('contextConfig')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveContext', config });
    });
    // LLM
    (_d = document.getElementById('saveLlmProvider')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
        var _a;
        const provider = ((_a = document.getElementById('llmProviderSetting')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveLlmProvider', provider });
    });
    (_e = document.getElementById('saveLlmAzure')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
        var _a;
        const config = ((_a = document.getElementById('llmAzure')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveLlmAzure', config });
    });
    (_f = document.getElementById('saveLlmLmstudio')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => {
        var _a;
        const config = ((_a = document.getElementById('llmLmstudio')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveLlmLmstudio', config });
    });
    (_g = document.getElementById('resetLlm')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', () => {
        vscode.postMessage({ type: 'resetLlm' });
    });
    // Embedding
    (_h = document.getElementById('saveEmbedProvider')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', () => {
        var _a;
        const provider = ((_a = document.getElementById('embedProvider')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveEmbeddingProvider', provider });
    });
    (_j = document.getElementById('saveEmbedAzure')) === null || _j === void 0 ? void 0 : _j.addEventListener('click', () => {
        var _a;
        const config = ((_a = document.getElementById('embedAzure')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveEmbeddingAzure', config });
    });
    (_k = document.getElementById('saveEmbedLmstudio')) === null || _k === void 0 ? void 0 : _k.addEventListener('click', () => {
        var _a;
        const config = ((_a = document.getElementById('embedLmstudio')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveEmbeddingLmstudio', config });
    });
    (_l = document.getElementById('resetEmbed')) === null || _l === void 0 ? void 0 : _l.addEventListener('click', () => {
        vscode.postMessage({ type: 'resetEmbedding' });
    });
    // Graphs
    const graphPicker = document.getElementById('graphPicker');
    if (graphPicker) {
        graphPicker.addEventListener('change', () => {
            state.selectedGraphId = graphPicker.value;
            vscode.postMessage({ type: 'selectGraph', graphId: state.selectedGraphId });
            vscode.postMessage({ type: 'loadGraph', graphId: state.selectedGraphId });
        });
    }
    (_m = document.getElementById('saveGraph')) === null || _m === void 0 ? void 0 : _m.addEventListener('click', () => {
        var _a;
        const config = ((_a = document.getElementById('graphJson')) === null || _a === void 0 ? void 0 : _a.value) || '';
        vscode.postMessage({ type: 'saveGraph', graphId: state.selectedGraphId, config });
    });
    (_o = document.getElementById('deleteGraph')) === null || _o === void 0 ? void 0 : _o.addEventListener('click', () => {
        vscode.postMessage({ type: 'deleteGraph', graphId: state.selectedGraphId });
    });
}
// ============================================================================
// Message Handler
// ============================================================================
window.addEventListener('message', (event) => {
    var _a, _b;
    const message = event.data;
    if (message.type === 'state') {
        const newState = message.state;
        state.runs = newState.runs || [];
        state.selectedRunId = newState.selectedRunId;
        state.connected = newState.connected;
        state.isAuthenticated = newState.isAuthenticated || false;
        state.userEmail = newState.userEmail;
        state.backendUrl = newState.backendUrl || '';
        state.apiToken = newState.apiToken || '';
        state.llm = newState.llm || state.llm;
        state.graphs = newState.graphs || [];
        state.selectedGraphId = newState.selectedGraphId || '';
        state.llmConfig = newState.llmConfig;
        state.embeddingConfig = newState.embeddingConfig;
        state.workspaceConfig = newState.workspaceConfig;
        state.contextConfig = newState.contextConfig;
        state.toolsList = newState.toolsList || [];
        state.graphDetail = newState.graphDetail;
        if (!state.llmSelection.provider && ((_a = state.llm) === null || _a === void 0 ? void 0 : _a.provider)) {
            state.llmSelection.provider = state.llm.provider;
        }
        if (!state.llmSelection.model && ((_b = state.llm) === null || _b === void 0 ? void 0 : _b.model)) {
            state.llmSelection.model = state.llm.model;
        }
        render();
    }
});
// Initial render
render();
