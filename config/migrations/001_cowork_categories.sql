-- Database migrations for CoWork-style multi-category support

-- Migration: Add work categories table
CREATE TABLE IF NOT EXISTS work_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    color VARCHAR(7),
    default_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT OR IGNORE INTO work_categories (id, name, description, icon, color, default_prompt) VALUES
('coding', 'Code Assistance', 'AI-powered code analysis, generation, and debugging', '💻', '#3B82F6', 'You are a senior software engineer helping with code tasks.'),
('drafting', 'Document Drafting', 'Create and edit professional documents', '✏️', '#10B981', 'You are a professional technical writer.'),
('automation', 'Workflow Automation', 'Create automated workflows and follow-ups', '⚡', '#F59E0B', 'You are a productivity automation specialist.'),
('general', 'General Assistance', 'Open-ended questions and general help', '🎯', '#6B7280', 'You are a versatile assistant capable of handling diverse tasks.');

-- Migration: Add workspace category configurations
CREATE TABLE IF NOT EXISTS workspace_category_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id VARCHAR(24) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    custom_name VARCHAR(100),
    custom_description TEXT,
    custom_icon VARCHAR(10),
    custom_color VARCHAR(7),
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, category_id)
);

-- Migration: Add workspace skill configurations
CREATE TABLE IF NOT EXISTS workspace_skill_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id VARCHAR(24) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    skill_id VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, category_id, skill_id)
);

-- Migration: Add workspace connector configurations
CREATE TABLE IF NOT EXISTS workspace_connector_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id VARCHAR(24) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    connector_id VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, category_id, connector_id)
);

-- Migration: Add automations table
CREATE TABLE IF NOT EXISTS workspace_automations (
    id VARCHAR(24) PRIMARY KEY,
    workspace_id VARCHAR(24) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    schedule VARCHAR(50),
    trigger_type VARCHAR(50),
    config JSONB,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Add context preservation table
CREATE TABLE IF NOT EXISTS context_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(24) NOT NULL,
    workspace_id VARCHAR(24) NOT NULL,
    from_category VARCHAR(50) NOT NULL,
    to_category VARCHAR(50) NOT NULL,
    preserved_context JSONB,
    preserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Add analytics events table
CREATE TABLE IF NOT EXISTS user_journey_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(24) NOT NULL,
    workspace_id VARCHAR(24),
    event_type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    previous_category VARCHAR(50),
    duration_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Add performance metrics table
CREATE TABLE IF NOT EXISTS category_performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id VARCHAR(50) NOT NULL,
    avg_latency_ms REAL,
    success_rate REAL,
    token_usage INTEGER,
    error_count INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Update agent runs to include category
ALTER TABLE agent_runs ADD COLUMN category_id VARCHAR(50);
ALTER TABLE agent_runs ADD COLUMN category_reason VARCHAR(100);
ALTER TABLE agent_runs ADD COLUMN optimization_config JSONB;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_category_configs_workspace ON workspace_category_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_category_configs_category ON workspace_category_configs(category_id);
CREATE INDEX IF NOT EXISTS idx_workspace_skill_configs_workspace ON workspace_skill_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_connector_configs_workspace ON workspace_connector_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_automations_workspace ON workspace_automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_automations_category ON workspace_automations(category_id);
CREATE INDEX IF NOT EXISTS idx_context_transitions_user ON context_transitions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_journey_events_user ON user_journey_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_journey_events_type ON user_journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_journey_events_created ON user_journey_events(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_category ON agent_runs(category_id);
