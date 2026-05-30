# Plan: Phase 5 — Chat API + Integration

## Summary
Wire the AI orchestrator, feature services, and UI components together through two Next.js API routes (`/api/chat` and `/api/events`) and a React client hook (`useAIChat`). A single POST to `/api/chat` creates or continues a conversation, calls the orchestrator, persists records in four Supabase tables, and returns a typed JSON response. `/api/events` triggers the approval → event-create → audit pipeline. The `useAIChat` hook provides Phase 6 with ready-to-use chat state management.

## User Story
As a developer, I want a working `/api/chat` endpoint that accepts a user message, runs the AI orchestrator, persists conversation/draft/ai_run/tool_call records, and returns a typed AI response, so that Phase 6 can wire the full chat UI without touching any backend logic.

## Problem → Solution
No `/api/chat` route exists; all service and AI code is untested end-to-end → Create the two API routes that connect every Phase 2+3 module and expose the full pipeline to the React frontend.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/ai-community-assistant-platform.prd.md`
- **PRD Phase**: Phase 5 — Chat API + Integration
- **Estimated Files**: 6

---

## UX Design

### Before
N/A — internal change. No user-facing page exists yet (Phase 6 handles the page). This phase provides the data layer.

### After
N/A — internal change.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| POST /api/chat | 404 | Returns `{ conversationId, draftId, approvalId, aiResponse }` | New route |
| POST /api/events | 404 | Returns `{ eventId }` | New route |
| useAIChat hook | Not exported | Exported from `hooks/useAIChat.ts` | Phase 6 consumes this |

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `features/ai/ai-orchestrator.ts` | 1-71 | Exact function signature and return type for `runOrchestrator` |
| P0 | `features/ai/structured-output-schema.ts` | 1-44 | `AIResponseSchema`, `AIResponse`, `EventDraftUpdate` types |
| P0 | `lib/supabase/types.ts` | 100-295 | Exact `MessageInsert`, `AiRunInsert`, `AiToolCallInsert`, `DraftInsert`, `ApprovalInsert` shapes |
| P0 | `lib/errors.ts` | 1-23 | `Result<T>`, `ok()`, `err()` — error unwrapping pattern |
| P1 | `features/events/event.service.ts` | 1-47 | Service error-handling and logging pattern |
| P1 | `features/drafts/draft.service.ts` | 1-49 | `updateDraft(id, updates: EventDraft)` signature |
| P1 | `features/approvals/approval.service.ts` | 1-53 | `createApproval`, `approve` signatures |
| P1 | `lib/supabase/server.ts` | 1-15 | `createServiceClient()` usage |
| P1 | `lib/constants.ts` | 1-11 | `DEMO_USER_ID`, `ConversationType` |
| P2 | `features/ai/prompt-builder.ts` | 1-70 | `PromptContext`, `MemoryContextEntry` types |
| P2 | `features/memory/memory.service.ts` | 1-21 | `getMemories(userId, keys?)` signature |
| P2 | `features/audit/audit.service.ts` | 1-26 | `log(entry)` signature |

## External Documentation
| Topic | Source | Key Takeaway |
|---|---|---|
| Next.js App Router route handlers | Already in codebase conventions | Export `async function POST(req: NextRequest): Promise<NextResponse>` |
| Vercel AI SDK generateObject | Used in orchestrator (`ai-orchestrator.ts:45`) | Already abstracted — call `runOrchestrator()`, not `generateObject` directly |
| Zod safeParse | Project uses Zod v4 | Use `.safeParse(body)` not `.parse(body)` — no throws |

---

## Patterns to Mirror

### ROUTE_HANDLER_PATTERN
```typescript
// SOURCE: This project has no existing route — mirror Next.js App Router conventions
// + logging/error style from features/events/event.service.ts:10-25
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const InputSchema = z.object({ field: z.string().min(1) })

export async function POST(req: NextRequest): Promise<NextResponse> {
  logger.info('POST /api/route-name')
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = InputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  try {
    // business logic
    return NextResponse.json({ result: 'ok' })
  } catch (e) {
    logger.error('Route failed', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### SERVICE_CALL_PATTERN
```typescript
// SOURCE: features/events/event.service.ts:10-24
// Instantiate, call, unwrap Result<T>
const svc = new EventService()
const result = await svc.createEvent(data)
if (result.error) {
  logger.error('Failed', { error: result.error.message })
  return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode })
}
const row = result.data  // T is unwrapped here
```

### SUPABASE_INSERT_SELECT_PATTERN
```typescript
// SOURCE: features/events/event.repository.ts:7-14
const { data: row, error } = await supabase
  .from('table_name')
  .insert(insertData)
  .select()
  .single()
if (error || !row) throw new Error(error?.message ?? 'Insert failed')
```

### SUPABASE_QUERY_FILTER_PATTERN
```typescript
// SOURCE: features/drafts/draft.repository.ts (findByConversation)
const { data } = await supabase
  .from('conversation_messages')
  .select('role, message_text')
  .eq('conversation_id', conversationId)
  .in('role', ['user', 'assistant'])
  .order('created_at', { ascending: true })
```

### JSON_TYPE_CAST_PATTERN
```typescript
// SOURCE: features/drafts/draft.service.ts:27,31
// When passing Record<string, unknown> or arrays to Json columns, cast through unknown
draft_json: mergedDraft as unknown as Json
missing_fields_json: getMissingEventFields(mergedDraft) as unknown as Json
```

### LOGGER_PATTERN
```typescript
// SOURCE: features/events/event.service.ts:11,14,19,22
logger.info('EventService.createEvent start')
logger.warn('Validation failed', { issues: [...] })
logger.info('Succeeded', { id: row.id })
logger.error('Failed', { error: String(e) })
```

### REACT_HOOK_PATTERN
```typescript
// SOURCE: components/ai-chat/ChatComposer.tsx:8-9 (client boundary) + React 19 pattern
'use client'
import { useState, useCallback } from 'react'

export function useFeature() {
  const [state, setState] = useState<Type>(initial)
  const action = useCallback(async (input: Input) => {
    // ...
  }, [deps])
  return { state, action }
}
```

### TEST_STRUCTURE_SCHEMA_VALIDATION
```typescript
// SOURCE: components/shared/__tests__/shared.test.ts:1-5 (export-shape tests)
// + project uses bun:test, no jsdom
import { describe, test, expect } from 'bun:test'
import { z } from 'zod'

const Schema = z.object({ field: z.string() })
describe('schema validation', () => {
  test('accepts valid input', () => {
    expect(Schema.safeParse({ field: 'ok' }).success).toBe(true)
  })
  test('rejects invalid input', () => {
    expect(Schema.safeParse({}).success).toBe(false)
  })
})
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `app/api/chat/route.ts` | CREATE | Main chat endpoint — orchestrates conversation lifecycle |
| `app/api/events/route.ts` | CREATE | Approval → event creation → audit pipeline |
| `hooks/useAIChat.ts` | CREATE | Client hook for Phase 6 to consume |
| `app/api/chat/__tests__/chat.test.ts` | CREATE | Schema validation tests for chat route |
| `app/api/events/__tests__/events.test.ts` | CREATE | Schema validation tests for events route |
| `hooks/__tests__/useAIChat.test.ts` | CREATE | Export-shape test for hook |

## NOT Building
- Streaming responses (`streamObject`) — using `runOrchestrator` (non-streaming JSON) for POC simplicity; streaming is Phase 6+ enhancement
- Actual tool execution — AI returns tool names in `tool_calls`; persisted as audit records; real execution is Phase 6+
- Authentication — uses `DEMO_USER_ID` throughout (seeded demo user)
- `/ai-community/page.tsx` wiring — Phase 6
- `/events/[id]/page.tsx` — Phase 6
- Conversation summarization / sliding window — deferred

---

## Step-by-Step Tasks

### Task 1: Create `app/api/chat/route.ts`
- **ACTION**: Create the main chat API route handler
- **IMPLEMENT**: Full POST handler that: (a) validates body, (b) creates/looks up conversation, (c) loads history + memory + draft, (d) persists user message, (e) creates ai_run, (f) calls `runOrchestrator`, (g) updates ai_run, (h) persists tool calls, (i) upserts draft, (j) creates approval if required, (k) persists assistant message, (l) returns typed JSON
- **MIRROR**: ROUTE_HANDLER_PATTERN, SERVICE_CALL_PATTERN, SUPABASE_INSERT_SELECT_PATTERN, JSON_TYPE_CAST_PATTERN, LOGGER_PATTERN
- **IMPORTS**:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { z } from 'zod'
  import { logger } from '@/lib/logger'
  import { DEMO_USER_ID } from '@/lib/constants'
  import { createServiceClient } from '@/lib/supabase/server'
  import { runOrchestrator } from '@/features/ai/ai-orchestrator'
  import { MemoryService } from '@/features/memory/memory.service'
  import { DraftService } from '@/features/drafts/draft.service'
  import { ApprovalService } from '@/features/approvals/approval.service'
  import { getEventDraftCompletionPercentage, getMissingEventFields } from '@/features/events/event.types'
  import type { PromptContext, MemoryContextEntry } from '@/features/ai/prompt-builder'
  import type { MessageInput } from '@/features/ai/ai-orchestrator'
  import type { Json, MessageInsert, AiRunInsert, AiToolCallInsert, DraftInsert, ApprovalInsert } from '@/lib/supabase/types'
  import type { EventDraft } from '@/features/events/event.types'
  ```
- **GOTCHA 1**: `SUPABASE_SERVICE_ROLE_KEY` MUST NEVER be `NEXT_PUBLIC_` prefixed. `createServiceClient()` already reads `process.env.SUPABASE_SERVICE_ROLE_KEY` safely — never expose it to the browser.
- **GOTCHA 2**: Load conversation history with `.in('role', ['user', 'assistant'])` — exclude `system` and `tool` roles, as `runOrchestrator` builds its own system prompt.
- **GOTCHA 3**: When creating a new draft, compute `completion_percentage` using `getEventDraftCompletionPercentage(draftUpdate as EventDraft)` and cast `missing_fields_json` via `as unknown as Json`.
- **GOTCHA 4**: The `metadata_json` column is `Json | null`. Cast the metadata object with `as unknown as Json`.
- **GOTCHA 5**: `ai_runs.input_tokens` is `number | null` — pass `null` initially (before orchestrator call), update after.
- **GOTCHA 6**: `conversation_messages.user_id` is `string | null` — pass `null` for assistant messages.
- **VALIDATE**: `bun run type-check` — zero errors
- **EXACT IMPLEMENTATION**:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { z } from 'zod'
  import { logger } from '@/lib/logger'
  import { DEMO_USER_ID } from '@/lib/constants'
  import { createServiceClient } from '@/lib/supabase/server'
  import { runOrchestrator } from '@/features/ai/ai-orchestrator'
  import { MemoryService } from '@/features/memory/memory.service'
  import { DraftService } from '@/features/drafts/draft.service'
  import { ApprovalService } from '@/features/approvals/approval.service'
  import { getEventDraftCompletionPercentage, getMissingEventFields } from '@/features/events/event.types'
  import type { PromptContext, MemoryContextEntry } from '@/features/ai/prompt-builder'
  import type { MessageInput } from '@/features/ai/ai-orchestrator'
  import type { Json, MessageInsert, AiRunInsert, AiToolCallInsert, DraftInsert, ApprovalInsert } from '@/lib/supabase/types'
  import type { EventDraft } from '@/features/events/event.types'

  export const runtime = 'nodejs'

  const ChatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    conversationId: z.string().uuid().optional(),
  })

  export async function POST(req: NextRequest): Promise<NextResponse> {
    logger.info('POST /api/chat')

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { message, conversationId: incomingConvoId } = parsed.data
    const userId = DEMO_USER_ID
    const supabase = createServiceClient()

    try {
      // 1. Get or create conversation
      let conversationId = incomingConvoId ?? null
      if (!conversationId) {
        const { data: convo, error: convoError } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            conversation_type: 'event_creation',
            status: 'active',
            current_entity_type: null,
            current_entity_id: null,
            title: null,
          })
          .select()
          .single()
        if (convoError || !convo) {
          logger.error('Failed to create conversation', { error: String(convoError) })
          return NextResponse.json({ error: 'Failed to start conversation' }, { status: 500 })
        }
        conversationId = convo.id
      }

      // 2. Load conversation history (user + assistant only)
      const { data: historyRows } = await supabase
        .from('conversation_messages')
        .select('role, message_text')
        .eq('conversation_id', conversationId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })

      const conversationHistory: MessageInput[] = (historyRows ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.message_text,
      }))

      // 3. Load user memory
      const memoryService = new MemoryService()
      const memoriesResult = await memoryService.getMemories(userId)
      const memories: MemoryContextEntry[] = (memoriesResult.data ?? []).map(m => ({
        key: m.memory_key,
        value: m.memory_value_json,
        confidence: m.confidence_score,
      }))

      // 4. Load current draft
      const draftService = new DraftService()
      const draftResult = await draftService.getDraftByConversation(conversationId)
      const existingDraft = draftResult.data ?? null
      const currentDraft = existingDraft
        ? (existingDraft.draft_json as Record<string, unknown>)
        : null

      // 5. Build PromptContext
      const context: PromptContext = {
        conversationType: 'event_creation',
        userName: 'Demo User',
        memories,
        currentDraft,
      }

      // 6. Persist user message
      const userMsgInsert: MessageInsert = {
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        message_text: message,
        message_type: 'text',
        metadata_json: null,
      }
      await supabase.from('conversation_messages').insert(userMsgInsert)

      // 7. Create ai_run (status = running)
      const aiRunInsert: AiRunInsert = {
        conversation_id: conversationId,
        user_id: userId,
        model_provider: 'openai',
        model_name: 'gpt-4o',
        input_tokens: null,
        output_tokens: null,
        status: 'running',
        error_message: null,
      }
      const { data: aiRun } = await supabase
        .from('ai_runs')
        .insert(aiRunInsert)
        .select()
        .single()

      // 8. Run AI orchestrator
      const orchestratorResult = await runOrchestrator({
        userMessage: message,
        conversationHistory,
        context,
      })

      if (orchestratorResult.error) {
        if (aiRun) {
          await supabase
            .from('ai_runs')
            .update({ status: 'failed', error_message: orchestratorResult.error.message })
            .eq('id', aiRun.id)
        }
        logger.error('Orchestrator failed in route', { error: orchestratorResult.error.message })
        return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
      }

      const aiResponse = orchestratorResult.data

      // 9. Update ai_run with token usage
      if (aiRun) {
        await supabase
          .from('ai_runs')
          .update({
            status: 'completed',
            input_tokens: aiResponse.usage.inputTokens,
            output_tokens: aiResponse.usage.outputTokens,
          })
          .eq('id', aiRun.id)
      }

      // 10. Persist tool calls (names only — for audit)
      if (aiRun && aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
        const toolCallInserts: AiToolCallInsert[] = aiResponse.tool_calls.map(toolName => ({
          ai_run_id: aiRun.id,
          tool_name: toolName,
          input_json: null,
          output_json: null,
          status: 'completed' as const,
          requires_approval: false,
          approved_by_user: null,
        }))
        await supabase.from('ai_tool_calls').insert(toolCallInserts)
      }

      // 11. Upsert draft if AI provided a draft_update
      let draftId = existingDraft?.id ?? null
      if (aiResponse.draft_update) {
        const draftUpdate = aiResponse.draft_update
        if (draftId) {
          await draftService.updateDraft(draftId, draftUpdate as EventDraft)
        } else {
          const newDraftInsert: DraftInsert = {
            user_id: userId,
            conversation_id: conversationId,
            entity_type: 'event',
            entity_id: null,
            draft_json: draftUpdate as unknown as Json,
            status: 'draft',
            completion_percentage: getEventDraftCompletionPercentage(draftUpdate as EventDraft),
            missing_fields_json: getMissingEventFields(draftUpdate as EventDraft) as unknown as Json,
            ai_summary: null,
          }
          const newDraftResult = await draftService.createDraft(newDraftInsert)
          draftId = newDraftResult.data?.id ?? null
        }
      }

      // 12. Create approval record if AI signals approval required
      let approvalId: string | null = null
      if (aiResponse.requires_approval && aiResponse.approval_action) {
        const approvalService = new ApprovalService()
        const approvalInsert: ApprovalInsert = {
          user_id: userId,
          conversation_id: conversationId,
          action_type: aiResponse.approval_action,
          action_payload_json: { draft: currentDraft ?? {} } as unknown as Json,
          status: 'pending',
          approved_at: null,
          rejected_at: null,
        }
        const approvalResult = await approvalService.createApproval(approvalInsert)
        approvalId = approvalResult.data?.id ?? null
      }

      // 13. Persist assistant message
      const assistantMsgInsert: MessageInsert = {
        conversation_id: conversationId,
        user_id: null,
        role: 'assistant',
        message_text: aiResponse.assistant_message,
        message_type: 'text',
        metadata_json: {
          intent: aiResponse.intent,
          requires_approval: aiResponse.requires_approval,
          quick_replies: aiResponse.quick_replies ?? [],
          missing_fields: aiResponse.missing_fields ?? [],
        } as unknown as Json,
      }
      await supabase.from('conversation_messages').insert(assistantMsgInsert)

      logger.info('POST /api/chat completed', {
        conversationId,
        intent: aiResponse.intent,
        requiresApproval: aiResponse.requires_approval,
        draftId,
        approvalId,
      })

      return NextResponse.json({
        conversationId,
        draftId,
        approvalId,
        aiResponse: {
          assistant_message: aiResponse.assistant_message,
          intent: aiResponse.intent,
          quick_replies: aiResponse.quick_replies ?? [],
          requires_approval: aiResponse.requires_approval,
          approval_action: aiResponse.approval_action,
          missing_fields: aiResponse.missing_fields ?? [],
        },
      })
    } catch (e) {
      logger.error('Chat route unexpected error', { error: String(e) })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  ```

### Task 2: Create `app/api/events/route.ts`
- **ACTION**: Create the event creation route (approval → create → audit)
- **IMPLEMENT**: POST handler that: (a) validates body, (b) loads approval from DB, (c) guards status=pending, (d) calls `ApprovalService.approve`, (e) extracts event payload from `action_payload_json`, (f) calls `EventService.createEvent`, (g) calls `AuditService.log`, (h) returns `{ eventId }`
- **MIRROR**: ROUTE_HANDLER_PATTERN, SERVICE_CALL_PATTERN, SUPABASE_QUERY_FILTER_PATTERN
- **IMPORTS**:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { z } from 'zod'
  import { logger } from '@/lib/logger'
  import { DEMO_USER_ID } from '@/lib/constants'
  import { createServiceClient } from '@/lib/supabase/server'
  import { ApprovalService } from '@/features/approvals/approval.service'
  import { EventService } from '@/features/events/event.service'
  import { AuditService } from '@/features/audit/audit.service'
  ```
- **GOTCHA 1**: The `action_payload_json` in the approval row is typed as `Json`. Cast it as `Record<string, unknown>` to access `payload` sub-key: `const payload = approval.action_payload_json as Record<string, unknown>`.
- **GOTCHA 2**: The draft stored in `action_payload_json.draft` is the currentDraft at approval time. Pass it merged with `{ organizer_id: userId, status: 'published', source: 'ai_chat' }` to `EventService.createEvent`.
- **GOTCHA 3**: `EventService.createEvent` takes `data: unknown` and validates internally with `EventInsertSchema`. Pass the full event object — it must include all required fields: `organizer_id`, `title`, `start_at`, `player_capacity`.
- **VALIDATE**: `bun run type-check` — zero errors
- **EXACT IMPLEMENTATION**:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { z } from 'zod'
  import { logger } from '@/lib/logger'
  import { DEMO_USER_ID } from '@/lib/constants'
  import { createServiceClient } from '@/lib/supabase/server'
  import { ApprovalService } from '@/features/approvals/approval.service'
  import { EventService } from '@/features/events/event.service'
  import { AuditService } from '@/features/audit/audit.service'

  export const runtime = 'nodejs'

  const CreateEventSchema = z.object({
    approvalId: z.string().uuid(),
  })

  export async function POST(req: NextRequest): Promise<NextResponse> {
    logger.info('POST /api/events')

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = CreateEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { approvalId } = parsed.data
    const userId = DEMO_USER_ID
    const supabase = createServiceClient()

    try {
      // Load approval
      const { data: approval, error: approvalError } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .maybeSingle()

      if (approvalError || !approval) {
        return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
      }
      if (approval.status !== 'pending') {
        return NextResponse.json({ error: 'Approval is not pending' }, { status: 409 })
      }

      // Approve the record
      const approvalService = new ApprovalService()
      const approveResult = await approvalService.approve(approvalId)
      if (approveResult.error) {
        logger.error('Failed to approve', { error: approveResult.error.message })
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
      }

      // Extract event payload from approval
      const payload = approval.action_payload_json as Record<string, unknown>
      const draftData = (payload.draft ?? {}) as Record<string, unknown>
      const eventData = {
        ...draftData,
        organizer_id: userId,
        status: 'published',
        source: 'ai_chat',
      }

      // Create event
      const eventService = new EventService()
      const eventResult = await eventService.createEvent(eventData)
      if (eventResult.error) {
        logger.error('Failed to create event', { error: eventResult.error.message })
        return NextResponse.json({ error: eventResult.error.message }, { status: eventResult.error.statusCode })
      }

      const event = eventResult.data

      // Audit log
      const auditService = new AuditService()
      await auditService.log({
        actor_user_id: userId,
        action: 'event.created',
        entity_type: 'event',
        entity_id: event.id,
        before_json: null,
        after_json: event as unknown as Record<string, unknown>,
      })

      logger.info('POST /api/events completed', { eventId: event.id })

      return NextResponse.json({ eventId: event.id })
    } catch (e) {
      logger.error('Events route unexpected error', { error: String(e) })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  ```

### Task 3: Create `hooks/useAIChat.ts`
- **ACTION**: Create the React client hook for managing chat state
- **IMPLEMENT**: `useAIChat()` hook that provides: `messages`, `draft` (with `id`, `fields`, `completionPct`, `missingFields`), `conversationId`, `isLoading`, `error`, `sendMessage(text)`, `approveEvent(approvalId) → Promise<string>`. Uses plain `fetch` to `/api/chat` and `/api/events`. Optimistic user message added before request, removed on failure.
- **MIRROR**: REACT_HOOK_PATTERN
- **IMPORTS**:
  ```typescript
  'use client'
  import { useState, useCallback } from 'react'
  ```
- **GOTCHA 1**: This is a `'use client'` file. Never import from server-only modules (no `createServiceClient`, no `runOrchestrator`).
- **GOTCHA 2**: `approveEvent` returns the `eventId` as a string — Phase 6 uses this for `router.push('/events/' + eventId)`.
- **GOTCHA 3**: Remove the optimistic user message on fetch failure to keep state clean.
- **VALIDATE**: `bun run type-check` — zero errors
- **EXACT IMPLEMENTATION**:
  ```typescript
  'use client'
  import { useState, useCallback } from 'react'

  export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    quickReplies?: string[]
    requiresApproval?: boolean
    approvalId?: string | null
    missingFields?: string[]
  }

  export interface DraftState {
    id: string | null
    fields: Record<string, unknown>
    completionPct: number
    missingFields: string[]
  }

  export interface UseAIChatReturn {
    messages: ChatMessage[]
    draft: DraftState
    conversationId: string | null
    isLoading: boolean
    error: string | null
    sendMessage: (text: string) => Promise<void>
    approveEvent: (approvalId: string) => Promise<string>
  }

  export function useAIChat(): UseAIChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [draft, setDraft] = useState<DraftState>({ id: null, fields: {}, completionPct: 0, missingFields: [] })
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sendMessage = useCallback(async (text: string) => {
      if (!text.trim() || isLoading) return
      setIsLoading(true)
      setError(null)

      const optimisticId = `user-${Date.now()}`
      setMessages(prev => [...prev, { id: optimisticId, role: 'user', content: text }])

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, conversationId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error((errData as Record<string, unknown>).error as string ?? 'Chat request failed')
        }

        const data = await res.json() as {
          conversationId: string
          draftId: string | null
          approvalId: string | null
          aiResponse: {
            assistant_message: string
            intent: string
            quick_replies: string[]
            requires_approval: boolean
            approval_action: string | null
            missing_fields: string[]
          }
        }

        if (data.conversationId) setConversationId(data.conversationId)
        if (data.draftId) setDraft(prev => ({ ...prev, id: data.draftId, missingFields: data.aiResponse.missing_fields }))

        const assistantId = `assistant-${Date.now()}`
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: data.aiResponse.assistant_message,
          quickReplies: data.aiResponse.quick_replies,
          requiresApproval: data.aiResponse.requires_approval,
          approvalId: data.approvalId,
          missingFields: data.aiResponse.missing_fields,
        }])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      } finally {
        setIsLoading(false)
      }
    }, [conversationId, isLoading])

    const approveEvent = useCallback(async (approvalId: string): Promise<string> => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId }),
      })
      if (!res.ok) throw new Error('Event approval failed')
      const data = await res.json() as { eventId: string }
      return data.eventId
    }, [])

    return { messages, draft, conversationId, isLoading, error, sendMessage, approveEvent }
  }
  ```

### Task 4: Create `app/api/chat/__tests__/chat.test.ts`
- **ACTION**: Write schema validation tests for the chat route
- **IMPLEMENT**: Validate `ChatRequestSchema` inline (no route import — avoids Next.js server-side deps in bun test). 4 tests: accepts valid message, rejects empty message, accepts with valid UUID conversationId, rejects invalid UUID.
- **MIRROR**: TEST_STRUCTURE_SCHEMA_VALIDATION
- **IMPORTS**: `import { describe, test, expect } from 'bun:test'` + `import { z } from 'zod'`
- **GOTCHA**: Do NOT import the route itself — `next/server` and server-side Supabase imports cause bun test to fail. Redeclare the schema in the test or import from a shared location.
- **VALIDATE**: `bun test app/api/chat` — all tests pass
- **EXACT IMPLEMENTATION**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { z } from 'zod'

  const ChatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    conversationId: z.string().uuid().optional(),
  })

  describe('POST /api/chat schema', () => {
    test('accepts valid message', () => {
      expect(ChatRequestSchema.safeParse({ message: 'Create an event' }).success).toBe(true)
    })

    test('rejects empty message', () => {
      expect(ChatRequestSchema.safeParse({ message: '' }).success).toBe(false)
    })

    test('accepts message with valid conversationId', () => {
      const result = ChatRequestSchema.safeParse({
        message: 'Create an event',
        conversationId: '00000000-0000-4000-8000-000000000001',
      })
      expect(result.success).toBe(true)
    })

    test('rejects invalid conversationId uuid', () => {
      const result = ChatRequestSchema.safeParse({
        message: 'Create an event',
        conversationId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })
  })
  ```

### Task 5: Create `app/api/events/__tests__/events.test.ts`
- **ACTION**: Write schema validation tests for the events route
- **IMPLEMENT**: 3 tests: accepts valid UUID approvalId, rejects missing approvalId, rejects non-UUID approvalId.
- **MIRROR**: TEST_STRUCTURE_SCHEMA_VALIDATION
- **IMPORTS**: `import { describe, test, expect } from 'bun:test'` + `import { z } from 'zod'`
- **GOTCHA**: Same as Task 4 — do NOT import the route itself.
- **VALIDATE**: `bun test app/api/events` — all tests pass
- **EXACT IMPLEMENTATION**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { z } from 'zod'

  const CreateEventSchema = z.object({
    approvalId: z.string().uuid(),
  })

  describe('POST /api/events schema', () => {
    test('accepts valid approvalId', () => {
      const result = CreateEventSchema.safeParse({
        approvalId: '00000000-0000-4000-8000-000000000002',
      })
      expect(result.success).toBe(true)
    })

    test('rejects missing approvalId', () => {
      expect(CreateEventSchema.safeParse({}).success).toBe(false)
    })

    test('rejects non-uuid approvalId', () => {
      expect(CreateEventSchema.safeParse({ approvalId: 'bad-id' }).success).toBe(false)
    })
  })
  ```

### Task 6: Create `hooks/__tests__/useAIChat.test.ts`
- **ACTION**: Write export-shape test for the `useAIChat` hook
- **IMPLEMENT**: 1 test that verifies `useAIChat` is exported as a function. This mirrors the established test pattern from Phase 4.
- **MIRROR**: TEST_STRUCTURE_SCHEMA_VALIDATION (export-shape variant from shared.test.ts)
- **IMPORTS**: `import { describe, test, expect } from 'bun:test'` + `import { useAIChat } from '../useAIChat'`
- **GOTCHA**: The hook uses React (`useState`, `useCallback`). The function IS importable — it only fails when CALLED in a non-React environment. Export-shape test (checking `typeof`) does not invoke it.
- **VALIDATE**: `bun test hooks` — passes
- **EXACT IMPLEMENTATION**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { useAIChat } from '../useAIChat'

  describe('useAIChat hook', () => {
    test('useAIChat is a function', () => {
      expect(typeof useAIChat).toBe('function')
    })
  })
  ```

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| ChatRequestSchema — valid message | `{ message: 'Create event' }` | `success: true` | No |
| ChatRequestSchema — empty message | `{ message: '' }` | `success: false` | Yes |
| ChatRequestSchema — valid with convoId | `{ message: '...', conversationId: valid-uuid }` | `success: true` | No |
| ChatRequestSchema — invalid uuid | `{ message: '...', conversationId: 'bad' }` | `success: false` | Yes |
| CreateEventSchema — valid approvalId | `{ approvalId: valid-uuid }` | `success: true` | No |
| CreateEventSchema — missing approvalId | `{}` | `success: false` | Yes |
| CreateEventSchema — non-uuid | `{ approvalId: 'bad' }` | `success: false` | Yes |
| useAIChat export shape | import useAIChat | `typeof === 'function'` | No |

### Edge Cases Checklist
- [x] Empty message → rejected by schema (min length 1)
- [x] Message too long → rejected by schema (max 2000)
- [x] Invalid UUID for conversationId → rejected by schema
- [x] Non-pending approval → returns 409 from events route
- [x] Orchestrator failure → marks ai_run as 'failed', returns 500
- [x] Missing OPENAI_API_KEY → orchestrator returns error, caught in route
- [x] No draft_update from AI → draft not touched (existing draft preserved)
- [x] No tool_calls from AI → no ai_tool_calls inserted (safe skip)
- [x] requires_approval=false → no approval record created

---

## Validation Commands

### Static Analysis
```bash
bun run type-check
```
EXPECT: Zero type errors

### Unit Tests (affected area)
```bash
bun test app/api/chat
bun test app/api/events
bun test hooks
```
EXPECT: 8 tests pass, 0 fail

### Full Test Suite
```bash
bun test
```
EXPECT: All previously passing tests still pass (no regressions)

### Build
```bash
bun run build
```
EXPECT: Turbopack build succeeds with zero errors

### Manual End-to-End (requires OPENAI_API_KEY and Supabase)
```bash
# Start dev server
bun run dev

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create an 8-player doubles pickleball event this Saturday at 9am"}'
```
EXPECT: Returns JSON with `conversationId`, `draftId`, `aiResponse.assistant_message`; Supabase `conversation_messages`, `ai_runs`, `ai_tool_calls` tables have new rows.

---

## Acceptance Criteria
- [ ] `app/api/chat/route.ts` — POST handler creates/continues conversation, calls orchestrator, persists 4 table records, returns typed JSON
- [ ] `app/api/events/route.ts` — POST handler approves, creates event, writes audit log, returns `{ eventId }`
- [ ] `hooks/useAIChat.ts` — exports `useAIChat`, `ChatMessage`, `DraftState`, `UseAIChatReturn`
- [ ] All 8 tests pass
- [ ] `bun run type-check` — zero errors
- [ ] `bun run build` — clean build
- [ ] SUPABASE_SERVICE_ROLE_KEY is NEVER `NEXT_PUBLIC_` prefixed anywhere in these files

## Completion Checklist
- [ ] `export const runtime = 'nodejs'` in both routes (not edge — service clients need Node)
- [ ] `createServiceClient()` used in routes (not browser client)
- [ ] `DEMO_USER_ID` from `@/lib/constants` — not hardcoded
- [ ] Logger calls at start + end of every route handler
- [ ] All `Result<T>` unwrapped with `if (result.error)` before accessing `.data`
- [ ] JSON type casts use `as unknown as Json` pattern
- [ ] `hooks/useAIChat.ts` starts with `'use client'`
- [ ] No server-only imports in `hooks/useAIChat.ts`
- [ ] Tests do NOT import the route files directly
- [ ] `bun run type-check` clean before marking complete

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `Json` type mismatch on draft_json / metadata_json | M | Build fails | Use `as unknown as Json` cast throughout |
| `EventDraftUpdate as EventDraft` cast fails | L | Type error | Use `as unknown as EventDraft` if needed |
| Next.js server imports leak into hook | M | Type error | Hook starts with `'use client'`, imports only React |
| Zod UUID validation rejects version-0 UUIDs | M | Test failure | Use v4 UUIDs (`'00000000-0000-4000-8000-000000000001'`) in tests |
| bun test can't import Next.js server modules | H | Test failure | Tests redeclare schemas inline — do not import routes |
| OPENAI_API_KEY not set in dev | M | 500 error | orchestrator returns `MISSING_API_KEY` error, route returns 500 |

## Notes
- **Thread safety**: Each request instantiates fresh service objects (`new MemoryService()`) — safe for concurrent requests.
- **Approval payload**: The `action_payload_json.draft` stored at approval time is the draft snapshot at that moment. Subsequent draft edits don't affect an existing pending approval.
- **ai_run timing**: The ai_run is created BEFORE the orchestrator call (status=running) and updated AFTER (status=completed/failed). This gives a clear timeline for debugging.
- **Zod v4 UUID note**: `z.string().uuid()` in Zod v4 requires proper v4 UUIDs with the version nibble set to `4` (e.g., `'00000000-0000-4000-8000-000000000001'`). Version-0 UUIDs like `'00000000-0000-0000-0000-000000000001'` will FAIL validation.
- **No streaming in Phase 5**: The PRD mentions `streamObject` as aspirational. For the POC, `runOrchestrator` uses `generateObject` (synchronous structured output). Phase 6 can upgrade to streaming if needed — the hook's `sendMessage` function is streaming-ready (just swap `fetch` for a stream reader).
- **Phase 6 contract**: Phase 6 will import `useAIChat` from `@/hooks/useAIChat` and wire it into `app/ai-community/page.tsx`. The hook must not change its exported interface without updating Phase 6.
