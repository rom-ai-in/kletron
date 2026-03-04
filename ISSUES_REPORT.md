# Repository Issues Analysis Report

## Summary
This report documents all issues found in the Numezis Code repository through static analysis.

## 1. TypeScript Errors (Critical)

Found **20+ TypeScript compilation errors** that need to be fixed:

### Desktop App Issues
- `apps/desktop/src/hooks/useConversation.ts(589,38)`: Type mismatch between `ChatEvent[]` and `ReplayEvent[]`
- `apps/desktop/src/hooks/useModels.ts(95,18)`: Implicit 'any' type for parameter 'g'
- `apps/desktop/src/utils.ts`: Missing type declarations for 'diff' module (now fixed with @types/diff)
- `apps/desktop/src/utils.ts(148,27)` and `(148,33)`: Implicit 'any' types for parameters

### Web App Issues
- Multiple issues in automation routes related to `WebhookTriggerConfig` type mismatches
- `apps/web/app/design-system/docs.ts`: Duplicate property names in object literals (6 occurrences)

### Server Package Issues
- `packages/server/src/services/agentGraphExecutor.ts`: Multiple type errors with `findings` property:
  - Type 'unknown[]' not assignable to type 'Finding[]'
  - Occurs at lines: 509, 828, 1177, 1217, 1249, 1269, 1596, 1988, 2044, 2077
- Line 1596: Property 'reasons' does not exist on type 'RankedContextItem'

### UI Package Issues
- `packages/ui/src/components/automations/AutomationListSidebar.tsx`: Incorrect props passed to Lucide icons (title prop doesn't exist)
- Button variant type errors in BA components (using "outline" instead of allowed variants)

## 2. Linter Warnings

Found **910 lines** of linting output with:
- ~50 console.log statements that should use warn/error/info
- Many unused variables (especially in MCP server tools)
- Promise handling issues (floating promises)

## 3. Test Infrastructure Issues

Vitest test runner fails to start due to:
```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './module-runner' is not defined by "exports" in /home/romain/numezis-coder/node_modules/vite/package.json
```

This is a known issue with newer versions of Vite/Vitest. The test suite cannot be run until this dependency conflict is resolved.

## 4. Dependency Issues

- Node.js version mismatch: project requires Node 20+, but system has v18.19.1
- 21 vulnerabilities in dependencies (1 low, 11 moderate, 9 high)
- Vitest version incompatible with current Node.js version

## Recommendations

### Immediate Fixes Needed:
1. **Upgrade Node.js** to v20+ (required by project)
2. **Fix TypeScript errors** in agentGraphExecutor.ts (findings type issues)
3. **Fix automation route types** (webhookConfig secret field)
4. **Fix design-system docs** (duplicate property names)

### Medium Priority:
5. **Update dependencies** to resolve vulnerabilities
6. **Fix test infrastructure** by updating Vite/Vitest or downgrading
7. **Clean up console logs** in production code

### Long-term:
8. **Add proper type checking** for MCP server tools
9. **Improve CI/CD pipeline** to catch these issues earlier
10. **Document dependency requirements** more clearly

## Files with Most Issues:
- `packages/server/src/services/agentGraphExecutor.ts` (12+ errors)
- `apps/web/app/design-system/docs.ts` (6 errors)
- MCP server tools files (many linter warnings)

Would you like me to start fixing any of these issues?