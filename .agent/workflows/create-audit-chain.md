---
description: How to create and execute multi-stage audit chains
---

# Creating Multi-Stage Audit Chains

This workflow explains how to create, configure, and execute multi-stage audit chains using the Chain Executor architecture.

## Prerequisites

- MongoDB running with `MONGODB_URI` configured in `.env`
- MCP server running (`npm run dev`)
- At least one LLM provider configured (Azure OpenAI or LM Studio)

## Step 1: Create a Chain Configuration

There are two ways to create chains:

### Option A: Use Pre-configured Presets

```typescript
import { ChainConfigBuilder } from "@/src/services/chainConfigBuilder";

// Full audit (all 16 suites)
const fullAuditChain = ChainConfigBuilder.PRESETS.FULL_AUDIT;

// Security-focused
const securityChain = ChainConfigBuilder.PRESETS.SECURITY_DEEP_DIVE;

// I18n quality
const i18nChain = ChainConfigBuilder.PRESETS.I18N_QUALITY_CHAIN;
```

### Option B: Create Custom Chain

```typescript
const customChain = {
  name: "My Custom Audit",
  description: "Custom audit workflow for specific needs",
  stages: [
    {
      id: "stage-1",
      name: "Security Check",
      auditMode: "A6",
      llmProvider: "azure",
      llmModel: "gpt-4",
      userPromptTemplate: "Focus on authentication vulnerabilities in apps/api/",
    },
    {
      id: "stage-2",
      name: "Test Coverage",
      auditMode: "A5",
      llmProvider: "azure",
      userPromptTemplate: "Check test coverage for files flagged in stage-1",
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

## Step 2: Create the Chain via API

```bash
// turbo
curl -X POST http://localhost:3000/api/chains \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "SECURITY_DEEP_DIVE"
  }'
```

Or with custom config:

```bash
// turbo
curl -X POST http://localhost:3000/api/chains \
  -H "Content-Type: application/json" \
  -d @custom-chain.json
```

Response:
```json
{
  "chainId": "67a1b2c3d4e5f6a7b8c9d0e1"
}
```

## Step 3: Execute the Chain

```bash
// turbo
curl -X PUT "http://localhost:3000/api/chains/67a1b2c3d4e5f6a7b8c9d0e1/execute"
```

Response:
```json
{
  "status": "STARTED"
}
```

## Step 4: Monitor Progress

```bash
// turbo
curl -X GET "http://localhost:3000/api/chains/67a1b2c3d4e5f6a7b8c9d0e1"
```

Response:
```json
{
  "chain": {
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

Once the chain status is `COMPLETED`, retrieve the final report:

```bash
// turbo
curl -X GET "http://localhost:3000/api/chains/67a1b2c3d4e5f6a7b8c9d0e1/report"
```

## Advanced: Scheduled Chains

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

## Common Chain Patterns

### Pattern 1: Progressive Validation

Each stage checks one aspect, skipping downstream if blockers found:

```typescript
{
  stages: [
    { id: "structure", auditMode: "A14", ... },
    {
      id: "quality",
      auditMode: "A8",
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
    { id: "azure-pass", llmProvider: "azure", ... },
    { id: "lmstudio-pass", llmProvider: "lmstudio", ... },
    {
      id: "consolidation",
      llmProvider: "azure",
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
    { id: "quick-scan", auditMode: "A2", maxToolCalls: 3 },
    {
      id: "deep-dive",
      auditMode: "A6",
      skipIf: "quick-scan.findings.length === 0"
    },
  ]
}
```

## Troubleshooting

### Chain stuck in "PENDING"

Check cron scheduler is running:
```bash
// turbo
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

- Read the full proposal: `.numezis/ARCHITECTURE_ANALYSIS_AND_ENHANCEMENT_PROPOSAL.md`
- Explore pre-configured presets in `src/services/chainConfigBuilder.ts`
- Monitor chains in the web UI: `http://localhost:3000/chains`
