# Issue Summary: Multiple Messages Not Working

## Problem Description
When sending multiple messages in the chat interface, only the first message works. Subsequent messages are rejected with an error.

## Root Cause Analysis

### Primary Issue: Rate Limiting / Concurrent Message Prevention
**Location:** `apps/web/app/api/sessions/[id]/chat/route.ts` (lines 86-92)

The chat API has built-in logic to prevent concurrent messages:
- If a session is actively running (status not in ["COMPLETED", "FAILED", "PAUSED", "CANCELLED"])
- AND the run has been active for less than 30 seconds (STALE_RUN_MS = 30,000ms)
- THEN the API returns a **409 Conflict** error: "Session is still running. Wait for it to complete."

This means:
1. User sends first message → runs successfully
2. User sends second message while first is still running (within 30s) → rejected with 409
3. Only the first message ever gets processed

### Secondary Issues: Text Parsing and JSON Extraction
While investigating, we also found and fixed three related issues in text parsing:

#### Issue 1: `stripCodeFences` Function (agentGraphUtils.ts)
- The original implementation used regex that didn't handle multiple code fence markers
- Example: ```json\ncontent\n```\n``` would not be properly stripped
- Fixed with a loop-based approach that handles edge cases

#### Issue 2: `parseJsonOutput` Function (agentGraphUtils.ts)
- Used greedy regex `/\{[\s\S]*\}/` which could match incorrect ranges in complex JSON
- Changed to non-greedy `/\{[^{}]*\}/s` that properly handles nested objects
- The `s` flag makes `.` match newlines for multi-line JSON

#### Issue 3: Type Safety in `describeMessageContent` Function (agentGraphExecutor.ts)
- Had unsafe type assertions that could cause runtime errors
- Added proper type checking before accessing properties
- Improved handling of missing or undefined properties

## Solution Options

### Option A: Reduce the Stale Run Timeout (Recommended for most cases)
Change `STALE_RUN_MS` from 30,000ms to a smaller value like 5,000ms (5 seconds):
```typescript
const STALE_RUN_MS = 5 * 1000; // 5 seconds instead of 30
```
**Pros:**
- Users can send follow-up messages sooner
- Better UX for interactive conversations
- Still prevents truly concurrent execution

**Cons:**
- Might allow some edge cases where user sends message before previous completes

### Option B: Queue Messages (Advanced)
Implement a message queue that stores pending messages and processes them sequentially.
**Pros:**
- True multi-message support
- No messages lost

**Cons:**
- More complex implementation
- Requires database changes for queue storage
- Needs error handling for failed messages in queue

### Option C: Allow Concurrent Messages (Not Recommended)
Remove the concurrency check entirely.
**Pros:**
- Maximum flexibility

**Cons:**
- Could overwhelm the system
- Hard to manage state consistency
- Not recommended for production

## Implementation Recommendation

We recommend **Option A** with a timeout of 5,000ms (5 seconds):

```typescript
// In apps/web/app/api/sessions/[id]/chat/route.ts
const STALE_RUN_MS = 5 * 1000; // Reduced from 30s to 5s for better UX
```

This provides:
- Good balance between preventing concurrency and allowing quick follow-ups
- Better user experience for interactive conversations
- Still maintains system safety

## Files Modified

### Text Parsing Fixes (Already Implemented)
1. `/packages/server/src/services/agentGraphUtils.ts`
   - `stripCodeFences()` - improved handling of multiple code fences
   - `parseJsonOutput()` - fixed regex to properly extract JSON objects

2. `/packages/server/src/services/agentGraphExecutor.ts`
   - `describeMessageContent()` - added proper type safety checks

### Message Concurrency Fix (Recommended Next Step)
3. `/apps/web/app/api/sessions/[id]/chat/route.ts`
   - Reduce `STALE_RUN_MS` from 30,000ms to 5,000ms
