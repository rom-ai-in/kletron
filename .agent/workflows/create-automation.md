---
description: How to create and execute multi-stage automations
---

# Creating Multi-Stage Automations

This workflow explains how to create, configure, and execute multi-stage automations using the Automation Executor architecture.

## Prerequisites

- MongoDB running with `MONGODB_URI` configured in `.env`
- MCP server running (`npm run dev`)
- At least one LLM provider configured (Azure OpenAI or LM Studio)

## Step 1: Create an Automation Configuration

There are two ways to create automations:

### Option A: Use Pre-configured Presets

```typescript
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";

// Full audit (all 16 suites)
const fullAudit = AutomationConfigBuilder.PRESETS.FULL_AUDIT;

// Security-focused
const securityAutomation = AutomationConfigBuilder.PRESETS.SECURITY_DEEP_DIVE;

// I18n quality
const i18nAutomation = AutomationConfigBuilder.PRESETS.I18N_QUALITY;
```

### Option B: Create Custom Automation

```typescript
const customAutomation = {
  name: "My Custom Audit",
  description: "Custom audit workflow for specific needs",
  stages: [
    {
      id: "stage-1",
      name: "Security Check",
      graphId: "audit",
      llmProvider: "azure",
      llmModel: "gpt-4",
      prompt: "Focus on authentication vulnerabilities in apps/api/",
    },
    {
      id: "stage-2",
      name: "Test Coverage",
      graphId: "audit",
      llmProvider: "azure",
      prompt: "Check test coverage for files flagged in stage-1",
      contextFromPreviousStages: ["stage-1.findings"],
      skipIf: "stage-1.findings.length === 0",
    },
  ],
  schedule: {
    enabled: true,
    cron: "0 2 * * *", // 2 AM daily
    timezone: "Europe/Zurich",
  },
};
```

## Step 2: Create the Automation via API

```bash
curl -X POST http://localhost:3000/api/automations \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "SECURITY_DEEP_DIVE"
  }'
```

Or with custom config:

```bash
curl -X POST http://localhost:3000/api/automations \
  -H "Content-Type: application/json" \
  -d @custom-automation.json
```

Response:
```json
{
  "automationId": "67a1b2c3d4e5f6a7b8c9d0e1"
}
```

## Step 3: Execute the Automation

```bash
curl -X PUT "http://localhost:3000/api/automations/67a1b2c3d4e5f6a7b8c9d0e1/execute"
```

Response:
```json
{
  "status": "STARTED"
}
```

## Step 4: Monitor Progress

```bash
curl -X GET "http://localhost:3000/api/automations/67a1b2c3d4e5f6a7b8c9d0e1"
```

Response:
```json
{
  "automation": {
    "_id": "67a1b2c3d4e5f6a7b8c9d0e1",
    "name": "Security Deep Dive",
    "status": "RUNNING",
    "currentStageIndex": 1,
    "sessionIds": ["session-1", "session-2"],
    "aggregatedFindings": [
      {
        "type": "BLOQUANT",
        "file": "apps/api/src/auth/login.ts",
        "description": "Missing rate limiting on login endpoint",
        "lineStart": 42
      }
    ],
    "metadata": {
      "totalDuration": 120000,
      "totalClaims": 15,
      "totalVerified": 12,
      "totalRejected": 3
    }
  }
}
```

## Step 5: View Results

Once the automation status is `COMPLETED`, retrieve the final report:

```bash
curl -X GET "http://localhost:3000/api/automations/67a1b2c3d4e5f6a7b8c9d0e1/report"
```

## Advanced: Scheduled Automations

To enable cron scheduling:

```json
{
  "schedule": {
    "enabled": true,
    "cron": "0 2 * * *",
    "timezone": "Europe/Zurich",
    "maxRuns": 30
  }
}
```

Cron expression examples:
- `"0 2 * * *"` - Every day at 2 AM
- `"0 */6 * * *"` - Every 6 hours
- `"0 0 * * 0"` - Every Sunday at midnight
- `"0 9 * * 1-5"` - Weekdays at 9 AM

## Common Automation Patterns

### Pattern 1: Progressive Validation

Each stage checks one aspect, skipping downstream if blockers found:

```typescript
{
  stages: [
    { id: "structure", graphId: "audit", llmProvider: "azure", prompt: "..." },
    {
      id: "quality",
      graphId: "audit",
      llmProvider: "azure",
      prompt: "...",
      skipIf: "structure.findings.filter(f => f.type === 'BLOQUANT').length > 0"
    },
  ]
}
```

### Pattern 2: LLM Consensus

Run same audit with different LLMs, then consolidate:

```typescript
{
  stages: [
    { id: "azure-pass", llmProvider: "azure", graphId: "audit", prompt: "..." },
    { id: "lmstudio-pass", llmProvider: "lmstudio", graphId: "audit", prompt: "..." },
    {
      id: "consolidation",
      llmProvider: "azure",
      graphId: "audit",
      prompt: "Consolidate findings from both passes",
      contextFromPreviousStages: ["azure-pass.findings", "lmstudio-pass.findings"]
    },
  ]
}
```

### Pattern 3: Conditional Deep Dive

Only run expensive audits if initial scan finds issues:

```typescript
{
  stages: [
    { id: "quick-scan", graphId: "audit", llmProvider: "azure", prompt: "Quick scan..." },
    {
      id: "deep-dive",
      graphId: "audit",
      llmProvider: "azure",
      prompt: "Deep security analysis...",
      skipIf: "quick-scan.findings.length === 0"
    },
  ]
}
```

## Troubleshooting

### Automation stuck in "PENDING"

Check cron scheduler is running:
```bash
curl -X GET http://localhost:3000/api/scheduler/status
```

### Stage failed with timeout

Increase timeout in stage config:
```json
{
  "phaseOverrides": {
    "phase3": {
      "timeoutMs": 600000
    }
  }
}
```

### High LLM costs

Add budget limits:
```json
{
  "maxTokens": 100000,
  "stopOnBudgetExceeded": true
}
```

## Next Steps

- Explore pre-configured presets in `packages/shared/src/automationConfigBuilder.ts`
- Monitor automations in the web UI: `http://localhost:3000/app/automations`
