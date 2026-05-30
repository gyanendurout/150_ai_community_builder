# Plan: Phase 2 — AI Core

## Summary
Implement the five AI Core modules inside `features/ai/`: a Zod structured-output schema, an OpenAI model-provider abstraction, a tool-registry with 8 stub tool definitions, a system-prompt builder with memory-context injection, and an orchestrator that calls `generateObject` and returns a typed `AIResponse`. Add `bun test` unit tests for schemas and prompt builder. No UI, no API route — pure service-layer logic.

## User Story
As the AI orchestration layer, I want to convert a raw user message + conversation history into a validated `AIResponse` object (intent, draft_update, quick_replies, tool_calls), so that Phase 5 (Chat API) can stream structured output to the frontend without any untyped string parsing.

## Problem → Solution
Placeholder `features/ai/index.ts` exports nothing → 5 concrete modules that give the app a fully-typed AI spine ready for Phase 5 to wire to the HTTP layer.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/ai-community-assistant-platform.prd.md`
- **PRD Phase**: Phase 2 — AI Core
- **Estimated Files**: 9 (5 new modules + index update + 2 tests + package.json)

---

## UX Design

### Before / After
N/A — internal change. No user-facing UI in this phase.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| AI response | untyped string | `AIResponse` Zod-validated object | consumed by Phase 5 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/errors.ts` | 1–22 | `Result<T>`, `ok()`, `err()` — ALL async functions must return this |
| P0 | `lib/logger/index.ts` | 1–15 | `logger.info/debug/error` — call before and after every AI operation |
| P0 | `lib/supabase/types.ts` | 262–279 | `MessageRow`, `AiRunInsert`, `AiToolCallInsert` type aliases |
| P1 | `lib/constants.ts` | 1–10 | `CONVERSATION_TYPES`, `ConversationType` union |
| P1 | `features/events/event.types.ts` | 1–56 | `EventDraft`, required-field helpers — mirror for `EventDraftUpdateSchema` |
| P1 | `lib/config/feature-flags.ts` | 1–37 | Caching pattern + `FLAGS` const object — mirror for `toolRegistry` shape |
| P2 | `lib/supabase/server.ts` | 1–15 | `createServiceClient()` — tools will use this in Phase 5 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `generateObject` | node_modules/ai/dist/index.d.ts | Uses **`schema`** param (not `output`); does NOT support `tools` |
| `tool()` helper | node_modules/ai/dist/index.d.ts | Takes `{ description, inputSchema, execute }` — `inputSchema` not `parameters` |
| OpenAI provider | node_modules/@ai-sdk/openai/dist/index.d.ts | `import { openai } from '@ai-sdk/openai'`; `openai('gpt-4o')` returns `LanguageModel` |
| ModelMessage type | node_modules/ai/dist/index.d.ts | Import as `ModelMessage` from `'ai'`; union of System/User/Assistant/Tool variants |
| Zod v4 | installed as `zod@^4.4.3` | `z.enum`, `.optional()`, `.nullable()`, `.safeParse()` all work same as v3 |

---

## Patterns to Mirror

### RESULT_TYPE
```typescript
// SOURCE: lib/errors.ts:12-21
export type Result<T> = { data: T; error: null } | { data: null; error: AppError }
export function ok<T>(data: T): Result<T> { return { data, error: null } }
export function err(message: string, code: string, statusCode = 500): Result<never> {
  return { data: null, error: new AppError(message, code, statusCode) }
}
// RULE: every async function in this phase returns Result<T> and catches all throws
```

### LOGGING_PATTERN
```typescript
// SOURCE: lib/logger/index.ts:10-14
// lib/config/feature-flags.ts:17-18, 23
logger.debug('Orchestrator starting', { conversationId, historyLength })
logger.info('Orchestrator completed', { intent, inputTokens, outputTokens })
logger.error('Orchestrator failed', { error: String(e) })
// RULE: debug before, info on success, error on catch — always pass context object
```

### CONST_OBJECT_PATTERN
```typescript
// SOURCE: lib/config/feature-flags.ts:29-37
export const FLAGS = {
  AI_EVENT_CREATION: 'feature_ai_event_creation',
  // ...
} as const
// MIRROR: toolRegistry and AI_TOOL_NAMES use the same const-object pattern
```

### OPTIONAL_FIELDS_TYPE
```typescript
// SOURCE: features/events/event.types.ts:8-21
export interface EventDraft {
  title?: string
  event_type?: EventType
  player_capacity?: number
  // all fields optional — AI fills progressively
}
// MIRROR: EventDraftUpdateSchema has the same optional fields as Zod z.object({...optional...})
```

### ERROR_CODES
```typescript
// SOURCE: lib/config/feature-flags.ts:17, 23
logger.error('Failed to load feature flags', { error: error.message })
// RULE: error codes are UPPER_SNAKE_CASE strings: 'MISSING_API_KEY', 'MODEL_INIT_FAILED', 'ORCHESTRATOR_FAILED', 'SCHEMA_VALIDATION_FAILED'
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `features/ai/structured-output-schema.ts` | CREATE | Zod schema for AIResponse — type contract between orchestrator and all consumers |
| `features/ai/model-provider.ts` | CREATE | OpenAI abstraction — swap-ready (GPT-4o today, any model later) |
| `features/ai/tool-registry.ts` | CREATE | 8 tool definitions with stub execute — real impl wired in Phase 5 |
| `features/ai/prompt-builder.ts` | CREATE | System prompt + memory context → `ModelMessage[]` |
| `features/ai/ai-orchestrator.ts` | CREATE | `generateObject` call → `Result<OrchestratorOutput>` |
| `features/ai/index.ts` | UPDATE | Replace placeholder with real exports |
| `features/ai/__tests__/structured-output-schema.test.ts` | CREATE | Zod validation tests (no mocking needed) |
| `features/ai/__tests__/prompt-builder.test.ts` | CREATE | Prompt content tests (no mocking needed) |
| `package.json` | UPDATE | Add `"test": "bun test"` script |

## NOT Building
- Actual OpenAI API calls in tests (mocked — no real API cost in CI)
- Conversation persistence to Supabase (Phase 5)
- Tool execution against real services (Phase 5 — stubs only in Phase 2)
- Streaming (`streamObject`) — that's the `app/api/chat/route.ts` in Phase 5
- Any UI component or API route

---

## Step-by-Step Tasks

### Task 1: Create `features/ai/structured-output-schema.ts`
- **ACTION**: Create Zod schema for every AI response field
- **IMPLEMENT**:
  ```typescript
  import { z } from 'zod'

  export const ConversationIntentSchema = z.enum([
    'event_creation', 'tournament_creation', 'profile_creation', 'general', 'clarification',
  ])
  export type ConversationIntent = z.infer<typeof ConversationIntentSchema>

  export const ApprovalActionSchema = z.enum([
    'create_event', 'send_invites', 'publish_tournament', 'save_profile',
  ])
  export type ApprovalAction = z.infer<typeof ApprovalActionSchema>

  export const EventDraftUpdateSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    event_type: z.enum(['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament']).optional(),
    sport_type: z.string().optional(),
    start_at: z.string().optional(),       // ISO 8601 string
    end_at: z.string().optional(),
    timezone: z.string().optional(),
    court_id: z.string().optional(),
    court_name: z.string().optional(),
    location_name: z.string().optional(),
    player_capacity: z.number().int().positive().optional(),
    visibility: z.enum(['public', 'private', 'invite_only']).optional(),
  })
  export type EventDraftUpdate = z.infer<typeof EventDraftUpdateSchema>

  export const AIResponseSchema = z.object({
    assistant_message: z.string().min(1),
    intent: ConversationIntentSchema,
    draft_update: EventDraftUpdateSchema.optional(),
    quick_replies: z.array(z.string()).max(4).optional(),
    tool_calls: z.array(z.string()).optional(),
    requires_approval: z.boolean(),
    approval_action: ApprovalActionSchema.nullable(),
    missing_fields: z.array(z.string()).optional(),
  })
  export type AIResponse = z.infer<typeof AIResponseSchema>

  export function validateAIResponse(raw: unknown): AIResponse | null {
    const result = AIResponseSchema.safeParse(raw)
    return result.success ? result.data : null
  }
  ```
- **MIRROR**: OPTIONAL_FIELDS_TYPE (mirror EventDraft optional pattern for EventDraftUpdateSchema)
- **IMPORTS**: `import { z } from 'zod'`
- **GOTCHA**: `ApprovalActionSchema.nullable()` makes approval_action `ApprovalAction | null`, NOT `ApprovalAction | undefined`. The field must always be present in the response — set to `null` when no approval needed. Do NOT use `.optional()` here.
- **GOTCHA**: `quick_replies: z.array(z.string()).max(4)` — max 4 chips. PRD specifies this limit.
- **VALIDATE**: `bun run type-check` → 0 errors

### Task 2: Create `features/ai/model-provider.ts`
- **ACTION**: Wrap `@ai-sdk/openai` to return `Result<LanguageModel>` with env-key validation
- **IMPLEMENT**:
  ```typescript
  import { openai } from '@ai-sdk/openai'
  import type { LanguageModel } from 'ai'
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'

  export const AI_MODEL = 'gpt-4o' as const

  export type ModelConfig = {
    model: string
    temperature: number
    maxTokens: number
  }

  export const DEFAULT_MODEL_CONFIG: ModelConfig = {
    model: AI_MODEL,
    temperature: 0.3,
    maxTokens: 2000,
  }

  export function createLanguageModel(modelId: string = AI_MODEL): Result<LanguageModel> {
    if (!process.env.OPENAI_API_KEY) {
      logger.error('OPENAI_API_KEY not set')
      return err('OpenAI API key not configured', 'MISSING_API_KEY', 500)
    }
    try {
      const model = openai(modelId as Parameters<typeof openai>[0])
      logger.debug('Language model created', { model: modelId })
      return ok(model as LanguageModel)
    } catch (e) {
      logger.error('Model creation failed', { error: String(e) })
      return err('Failed to create language model', 'MODEL_INIT_FAILED', 500)
    }
  }
  ```
- **MIRROR**: RESULT_TYPE, LOGGING_PATTERN
- **IMPORTS**: `import { openai } from '@ai-sdk/openai'`, `import type { LanguageModel } from 'ai'`, `import { logger } from '@/lib/logger'`, `import { ok, err, type Result } from '@/lib/errors'`
- **GOTCHA**: `openai(modelId as Parameters<typeof openai>[0])` — the openai provider function expects a specific model ID union. Casting through `Parameters<typeof openai>[0]` avoids a type error without losing safety. If TypeScript rejects this, try `openai('gpt-4o' as any)` as fallback.
- **GOTCHA**: `DEFAULT_MODEL_CONFIG` is exported — Phase 5 will use it to set `temperature` and `maxTokens` in the `generateObject` call via `providerOptions` or similar.
- **VALIDATE**: `bun run type-check` → 0 errors

### Task 3: Create `features/ai/tool-registry.ts`
- **ACTION**: Define all 8 tool schemas + stub execute functions using `tool()` from `ai` SDK
- **IMPLEMENT**:
  ```typescript
  import { tool } from 'ai'
  import { z } from 'zod'
  import { logger } from '@/lib/logger'

  // ── Return type shapes (used by Phase 5 to type-check tool output consumers) ──

  export type MemoryEntry = { key: string; value: unknown; confidence: number }
  export type TimeOption = { label: string; start_at: string; end_at: string }
  export type CourtOption = { id: string; name: string; address: string; indoor_outdoor: string; distance_km: number | null }
  export type WeatherData = { date: string; condition: string; temp_c: number; suitable_for_outdoor: boolean }
  export type TitleSuggestion = { title: string }
  export type InviteMessage = { subject: string; body: string }
  export type ApprovalPayload = { action_type: 'create_event'; payload: Record<string, unknown> }

  // ── Tool definitions ─────────────────────────────────────────────────────────

  export const toolRegistry = {
    get_user_memory: tool({
      description: 'Fetch the user memory preferences relevant to event creation (preferred court, time, player count, event type).',
      inputSchema: z.object({
        user_id: z.string().uuid(),
        memory_keys: z.array(z.string()).optional(),
      }),
      execute: async ({ user_id, memory_keys }) => {
        logger.debug('tool:get_user_memory', { user_id, memory_keys })
        // Stub — replaced by MemoryService in Phase 5
        return { memories: [] as MemoryEntry[] }
      },
    }),

    update_event_draft: tool({
      description: 'Update the in-progress event draft with new field values and return the updated draft state.',
      inputSchema: z.object({
        conversation_id: z.string().uuid(),
        user_id: z.string().uuid(),
        updates: z.record(z.unknown()),
      }),
      execute: async ({ conversation_id, updates }) => {
        logger.debug('tool:update_event_draft', { conversation_id, fields: Object.keys(updates) })
        // Stub — replaced by DraftService in Phase 5
        return { draft: updates, completion_percentage: 0, missing_fields: [] as string[] }
      },
    }),

    suggest_event_time: tool({
      description: 'Suggest 3 upcoming event time options based on the user preferred day and time from memory.',
      inputSchema: z.object({
        user_id: z.string().uuid(),
        preferred_day: z.string().optional(),
        preferred_time: z.string().optional(),
      }),
      execute: async ({ user_id }) => {
        logger.debug('tool:suggest_event_time', { user_id })
        // Stub — returns mock times for POC
        const now = new Date()
        const options: TimeOption[] = [0, 7, 14].map(daysAhead => {
          const d = new Date(now)
          d.setDate(d.getDate() + daysAhead + (6 - d.getDay()))
          d.setHours(9, 0, 0, 0)
          const end = new Date(d)
          end.setHours(10, 30, 0, 0)
          return {
            label: `Saturday ${d.toLocaleDateString()}`,
            start_at: d.toISOString(),
            end_at: end.toISOString(),
          }
        })
        return { options }
      },
    }),

    suggest_courts: tool({
      description: 'Return the list of available pickleball courts with optional distance estimate.',
      inputSchema: z.object({
        user_id: z.string().uuid(),
        max_results: z.number().int().positive().optional().default(5),
      }),
      execute: async ({ user_id }) => {
        logger.debug('tool:suggest_courts', { user_id })
        // Stub — replaced by CourtService in Phase 5
        return { courts: [] as CourtOption[] }
      },
    }),

    check_weather: tool({
      description: 'Return a weather stub for the requested date and location. Always returns mock data in POC.',
      inputSchema: z.object({
        date: z.string(),
        location: z.string().optional(),
      }),
      execute: async ({ date }) => {
        logger.debug('tool:check_weather', { date })
        // Stub — WeatherService will replace with real API in post-POC
        const weather: WeatherData = {
          date,
          condition: 'Sunny',
          temp_c: 22,
          suitable_for_outdoor: true,
        }
        return { weather }
      },
    }),

    generate_event_title: tool({
      description: 'Generate 3 event title suggestions based on the current draft fields.',
      inputSchema: z.object({
        event_type: z.string().optional(),
        court_name: z.string().optional(),
        start_at: z.string().optional(),
      }),
      execute: async (input) => {
        logger.debug('tool:generate_event_title', input)
        const day = input.start_at ? new Date(input.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Next Saturday'
        const suggestions: TitleSuggestion[] = [
          { title: `${input.event_type === 'doubles' ? 'Doubles' : 'Open'} Play — ${day}` },
          { title: `${input.court_name ?? 'Joola'} ${input.event_type ?? 'Pickleball'} ${day}` },
          { title: `Saturday ${input.event_type === 'doubles' ? 'Doubles' : 'Pickleball'} Session` },
        ]
        return { suggestions }
      },
    }),

    generate_invite_message: tool({
      description: 'Generate a draft invite message for the event. Does NOT send — for review only.',
      inputSchema: z.object({
        event_title: z.string(),
        start_at: z.string().optional(),
        court_name: z.string().optional(),
        player_capacity: z.number().optional(),
      }),
      execute: async (input) => {
        logger.debug('tool:generate_invite_message', { event_title: input.event_title })
        const message: InviteMessage = {
          subject: `Join us: ${input.event_title}`,
          body: `Hey! We're organizing "${input.event_title}" — ${input.start_at ?? 'time TBD'} at ${input.court_name ?? 'Joola Court'}. Capacity: ${input.player_capacity ?? 8} players. Let me know if you can make it!`,
        }
        return { message }
      },
    }),

    prepare_create_event_approval: tool({
      description: 'Assemble the final approval payload for creating the event. Sets requires_approval=true in the AI response.',
      inputSchema: z.object({
        conversation_id: z.string().uuid(),
        user_id: z.string().uuid(),
        draft: z.record(z.unknown()),
      }),
      execute: async (input) => {
        logger.debug('tool:prepare_create_event_approval', { conversation_id: input.conversation_id })
        const payload: ApprovalPayload = {
          action_type: 'create_event',
          payload: { ...input.draft, organizer_id: input.user_id },
        }
        return { approval_payload: payload, requires_approval: true }
      },
    }),
  } as const

  export type ToolName = keyof typeof toolRegistry
  export const AI_TOOL_NAMES = Object.keys(toolRegistry) as ToolName[]
  ```
- **MIRROR**: CONST_OBJECT_PATTERN (mirror `FLAGS` const-object shape), LOGGING_PATTERN
- **IMPORTS**: `import { tool } from 'ai'`, `import { z } from 'zod'`, `import { logger } from '@/lib/logger'`
- **GOTCHA**: `tool()` from `ai` v6 uses `inputSchema`, NOT `parameters`. Using `parameters` will cause a type error.
- **GOTCHA**: `as const` on the registry ensures `ToolName` is a precise string-literal union, not `string`.
- **GOTCHA**: All `execute` stubs return empty arrays/objects — Phase 5 replaces with real service calls. Do NOT leave `execute` out — `tool()` type requires it.
- **VALIDATE**: `bun run type-check` → 0 errors

### Task 4: Create `features/ai/prompt-builder.ts`
- **ACTION**: Build the system prompt string from conversation context + user memory
- **IMPLEMENT**:
  ```typescript
  import type { ConversationType } from '@/lib/constants'
  import { logger } from '@/lib/logger'
  import { AI_TOOL_NAMES } from './tool-registry'

  export type MemoryContextEntry = {
    key: string
    value: unknown
    confidence: number
  }

  export type PromptContext = {
    conversationType: ConversationType
    userName: string
    memories: MemoryContextEntry[]
    currentDraft: Record<string, unknown> | null
  }

  const BASE_SYSTEM_PROMPT = `You are an AI community assistant for Joola — a pickleball sports community platform. Your primary role is to help community organizers create events through natural conversation.

RESPONSE FORMAT: You MUST respond with a valid JSON object matching the AIResponse schema. Never respond with plain text.

REQUIRED FIELDS in every response:
- assistant_message: your conversational reply (friendly, concise)
- intent: the detected conversation intent
- requires_approval: true only when the event draft is complete and ready for the user to approve
- approval_action: "create_event" when requires_approval is true, otherwise null

OPTIONAL FIELDS (include when relevant):
- draft_update: key-value pairs of event fields to update (partial OK)
- quick_replies: up to 4 short reply options to show the user as chips
- tool_calls: list of tool names to execute after this response
- missing_fields: list of required fields still needed

AVAILABLE TOOLS: ${AI_TOOL_NAMES.join(', ')}

CONVERSATION GOAL (event_creation):
Collect: title, event_type, start_at, player_capacity, court_id (or location_name).
Use the user's memory preferences as defaults. Ask only what is missing.
Maximum 5 exchanges to reach a complete draft.

BRAND TONE: Friendly, energetic, pickleball-enthusiast. Brief messages. No filler words.`

  function formatMemories(memories: MemoryContextEntry[]): string {
    if (memories.length === 0) return ''
    const lines = memories.map(m => `  ${m.key}: ${JSON.stringify(m.value)} (confidence: ${m.confidence})`)
    return `\nUSER MEMORY (use as defaults, don't ask for what you already know):\n${lines.join('\n')}`
  }

  function formatDraft(draft: Record<string, unknown> | null): string {
    if (!draft || Object.keys(draft).length === 0) return ''
    return `\nCURRENT DRAFT STATE:\n${JSON.stringify(draft, null, 2)}`
  }

  export function buildSystemPrompt(context: PromptContext): string {
    logger.debug('Building system prompt', {
      conversationType: context.conversationType,
      memoryCount: context.memories.length,
      hasDraft: !!context.currentDraft,
    })

    const parts = [
      BASE_SYSTEM_PROMPT,
      formatMemories(context.memories),
      formatDraft(context.currentDraft),
      `\nUSER NAME: ${context.userName}`,
      `\nCONVERSATION TYPE: ${context.conversationType}`,
    ]

    return parts.filter(Boolean).join('\n')
  }
  ```
- **MIRROR**: LOGGING_PATTERN, CONST_OBJECT_PATTERN
- **IMPORTS**: `import type { ConversationType } from '@/lib/constants'`, `import { logger } from '@/lib/logger'`, `import { AI_TOOL_NAMES } from './tool-registry'`
- **GOTCHA**: `ConversationType` is imported from `@/lib/constants` as a type (not value). The import must use `import type` or `import { CONVERSATION_TYPES, type ConversationType }`.
- **GOTCHA**: `formatMemories` uses `JSON.stringify(m.value)` since `memory_value_json` is JSONB — values can be numbers, strings, or objects. Never assume it's always a string.
- **VALIDATE**: `bun run type-check` → 0 errors

### Task 5: Create `features/ai/ai-orchestrator.ts`
- **ACTION**: Wire model-provider + prompt-builder + generateObject → typed `Result<OrchestratorOutput>`
- **IMPLEMENT**:
  ```typescript
  import { generateObject } from 'ai'
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import { createLanguageModel } from './model-provider'
  import { buildSystemPrompt, type PromptContext } from './prompt-builder'
  import { AIResponseSchema, type AIResponse } from './structured-output-schema'

  export type MessageInput = {
    role: 'user' | 'assistant' | 'system'
    content: string
  }

  export type OrchestratorInput = {
    userMessage: string
    conversationHistory: MessageInput[]
    context: PromptContext
  }

  export type OrchestratorOutput = AIResponse & {
    usage: { inputTokens: number; outputTokens: number }
  }

  export async function runOrchestrator(
    input: OrchestratorInput
  ): Promise<Result<OrchestratorOutput>> {
    logger.info('Orchestrator starting', {
      messageLength: input.userMessage.length,
      historyLength: input.conversationHistory.length,
      conversationType: input.context.conversationType,
    })

    const modelResult = createLanguageModel()
    if (modelResult.error) return modelResult

    const systemPrompt = buildSystemPrompt(input.context)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...input.conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: input.userMessage },
    ]

    try {
      const result = await generateObject({
        model: modelResult.data,
        schema: AIResponseSchema,
        schemaName: 'AIResponse',
        schemaDescription: 'Structured response from the Joola AI community assistant',
        messages,
      })

      logger.info('Orchestrator completed', {
        intent: result.object.intent,
        requiresApproval: result.object.requires_approval,
        hasDraftUpdate: !!result.object.draft_update,
        toolCalls: result.object.tool_calls ?? [],
      })

      return ok({
        ...result.object,
        usage: {
          inputTokens: (result.usage as Record<string, number>).promptTokens ?? (result.usage as Record<string, number>).inputTokens ?? 0,
          outputTokens: (result.usage as Record<string, number>).completionTokens ?? (result.usage as Record<string, number>).outputTokens ?? 0,
        },
      })
    } catch (e) {
      logger.error('Orchestrator failed', { error: String(e) })
      return err('AI orchestrator failed', 'ORCHESTRATOR_FAILED', 500)
    }
  }
  ```
- **MIRROR**: RESULT_TYPE, LOGGING_PATTERN
- **IMPORTS**: `import { generateObject } from 'ai'`, `import { logger } from '@/lib/logger'`, `import { ok, err, type Result } from '@/lib/errors'`, plus local modules
- **GOTCHA**: `generateObject` does NOT have a `tools` parameter in AI SDK v6. Tool execution is deferred — the `tool_calls` field in `AIResponse` tells Phase 5 which tools to call after receiving the AI response. Do NOT attempt to pass `tools:` to `generateObject`.
- **GOTCHA**: Usage token property names may vary by SDK version. Use the dual-lookup pattern: `(result.usage as Record<string, number>).promptTokens ?? (result.usage as Record<string, number>).inputTokens ?? 0` to handle both `promptTokens` (v3-4) and `inputTokens` (v6) naming.
- **GOTCHA**: `messages` must be typed as the SDK's message type. If TypeScript rejects the inline array, cast: `messages as Parameters<typeof generateObject>[0]['messages']`
- **VALIDATE**: `bun run type-check` → 0 errors

### Task 6: Update `features/ai/index.ts`
- **ACTION**: Replace placeholder comment with real barrel exports
- **IMPLEMENT**:
  ```typescript
  export * from './structured-output-schema'
  export * from './model-provider'
  export * from './tool-registry'
  export * from './prompt-builder'
  export * from './ai-orchestrator'
  ```
- **GOTCHA**: Do NOT re-export `z` from zod or any non-AI-module symbol — this barrel is the public API of the `ai` feature module.
- **VALIDATE**: `bun run type-check` → 0 errors

### Task 7: Add test script to `package.json`
- **ACTION**: Add `test` script that uses bun's built-in test runner
- **IMPLEMENT**: Edit `package.json` scripts section:
  ```json
  "test": "bun test",
  "test:ai": "bun test features/ai"
  ```
- **GOTCHA**: `bun test` discovers all `*.test.ts` files automatically — no config file needed.
- **VALIDATE**: `bun run test --dry-run` or `bun test --list` shows test files

### Task 8: Create `features/ai/__tests__/structured-output-schema.test.ts`
- **ACTION**: Write pure Zod validation tests — no AI SDK calls, no mocking
- **IMPLEMENT**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { AIResponseSchema, EventDraftUpdateSchema, validateAIResponse } from '../structured-output-schema'

  const VALID_EVENT_CREATION_RESPONSE = {
    assistant_message: 'Let me help you set up that doubles event!',
    intent: 'event_creation' as const,
    draft_update: { event_type: 'doubles', player_capacity: 8 },
    quick_replies: ['Saturday 9am', 'Different time', 'Check courts'],
    tool_calls: ['get_user_memory'],
    requires_approval: false,
    approval_action: null,
    missing_fields: ['title', 'start_at', 'court_id'],
  }

  describe('AIResponseSchema', () => {
    test('validates a complete event_creation response', () => {
      const result = AIResponseSchema.safeParse(VALID_EVENT_CREATION_RESPONSE)
      expect(result.success).toBe(true)
    })

    test('fails when assistant_message is empty', () => {
      expect(validateAIResponse({ ...VALID_EVENT_CREATION_RESPONSE, assistant_message: '' })).toBeNull()
    })

    test('fails when intent is unknown', () => {
      expect(validateAIResponse({ ...VALID_EVENT_CREATION_RESPONSE, intent: 'unknown_intent' })).toBeNull()
    })

    test('fails when quick_replies exceeds 4 items', () => {
      const tooMany = { ...VALID_EVENT_CREATION_RESPONSE, quick_replies: ['a', 'b', 'c', 'd', 'e'] }
      expect(validateAIResponse(tooMany)).toBeNull()
    })

    test('approval_action must be null when not requiring approval', () => {
      const r = validateAIResponse(VALID_EVENT_CREATION_RESPONSE)
      expect(r?.approval_action).toBeNull()
    })

    test('validates approval flow', () => {
      const approvalResponse = {
        ...VALID_EVENT_CREATION_RESPONSE,
        requires_approval: true,
        approval_action: 'create_event',
        missing_fields: [],
      }
      const r = validateAIResponse(approvalResponse)
      expect(r).not.toBeNull()
      expect(r?.requires_approval).toBe(true)
      expect(r?.approval_action).toBe('create_event')
    })

    test('fails when required fields are missing', () => {
      expect(validateAIResponse({})).toBeNull()
      expect(validateAIResponse({ assistant_message: 'hi' })).toBeNull()
    })
  })

  describe('EventDraftUpdateSchema', () => {
    test('all fields optional — empty object is valid', () => {
      expect(EventDraftUpdateSchema.safeParse({}).success).toBe(true)
    })

    test('player_capacity must be a positive integer', () => {
      expect(EventDraftUpdateSchema.safeParse({ player_capacity: -1 }).success).toBe(false)
      expect(EventDraftUpdateSchema.safeParse({ player_capacity: 8 }).success).toBe(true)
    })

    test('event_type must be from enum', () => {
      expect(EventDraftUpdateSchema.safeParse({ event_type: 'soccer' }).success).toBe(false)
      expect(EventDraftUpdateSchema.safeParse({ event_type: 'doubles' }).success).toBe(true)
    })
  })
  ```
- **MIRROR**: OPTIONAL_FIELDS_TYPE (test the same optional fields pattern)
- **IMPORTS**: `import { describe, test, expect } from 'bun:test'`
- **GOTCHA**: Bun test uses `bun:test` module, NOT `@jest/globals` or `vitest`. The import must be `from 'bun:test'`.
- **VALIDATE**: `bun test features/ai/__tests__/structured-output-schema.test.ts` → all pass

### Task 9: Create `features/ai/__tests__/prompt-builder.test.ts`
- **ACTION**: Test that prompt contains expected content — no mocking
- **IMPLEMENT**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { buildSystemPrompt } from '../prompt-builder'
  import type { PromptContext } from '../prompt-builder'

  const BASE_CONTEXT: PromptContext = {
    conversationType: 'event_creation',
    userName: 'Alex Chen',
    memories: [],
    currentDraft: null,
  }

  describe('buildSystemPrompt', () => {
    test('includes pickleball branding', () => {
      const prompt = buildSystemPrompt(BASE_CONTEXT)
      expect(prompt).toContain('pickleball')
      expect(prompt).toContain('Joola')
    })

    test('includes conversation type', () => {
      const prompt = buildSystemPrompt(BASE_CONTEXT)
      expect(prompt).toContain('event_creation')
    })

    test('includes user name', () => {
      const prompt = buildSystemPrompt(BASE_CONTEXT)
      expect(prompt).toContain('Alex Chen')
    })

    test('injects memory preferences into prompt', () => {
      const ctx: PromptContext = {
        ...BASE_CONTEXT,
        memories: [
          { key: 'preferred_day', value: 'Saturday', confidence: 0.9 },
          { key: 'preferred_court_name', value: 'Joola Court A', confidence: 0.95 },
        ],
      }
      const prompt = buildSystemPrompt(ctx)
      expect(prompt).toContain('preferred_day')
      expect(prompt).toContain('Saturday')
      expect(prompt).toContain('Joola Court A')
    })

    test('includes current draft state when provided', () => {
      const ctx: PromptContext = {
        ...BASE_CONTEXT,
        currentDraft: { event_type: 'doubles', player_capacity: 8 },
      }
      const prompt = buildSystemPrompt(ctx)
      expect(prompt).toContain('doubles')
    })

    test('omits draft section when draft is null', () => {
      const prompt = buildSystemPrompt(BASE_CONTEXT)
      expect(prompt).not.toContain('CURRENT DRAFT STATE')
    })

    test('returns string type', () => {
      expect(typeof buildSystemPrompt(BASE_CONTEXT)).toBe('string')
    })
  })
  ```
- **IMPORTS**: `import { describe, test, expect } from 'bun:test'`
- **VALIDATE**: `bun test features/ai/__tests__/prompt-builder.test.ts` → all pass

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| AIResponseSchema: valid event_creation | complete valid object | passes | No |
| AIResponseSchema: empty string message | `assistant_message: ''` | fails | Yes |
| AIResponseSchema: 5 quick_replies | array of 5 | fails | Yes (max 4) |
| AIResponseSchema: approval flow | requires_approval=true + approval_action='create_event' | passes | No |
| AIResponseSchema: missing required fields | `{}` | fails | Yes |
| EventDraftUpdateSchema: empty object | `{}` | passes (all optional) | Yes |
| EventDraftUpdateSchema: negative capacity | `{ player_capacity: -1 }` | fails | Yes |
| EventDraftUpdateSchema: invalid event_type | `{ event_type: 'soccer' }` | fails | Yes |
| prompt: contains pickleball | BASE_CONTEXT | prompt includes 'pickleball' | No |
| prompt: memory injection | 2 memory entries | prompt contains key+value | No |
| prompt: draft injection | currentDraft != null | prompt contains 'CURRENT DRAFT STATE' | No |
| prompt: no draft | currentDraft=null | prompt does NOT contain draft section | Yes |

### Edge Cases Checklist
- [x] Empty quick_replies (valid — field is optional)
- [x] approval_action = null (not undefined) when no approval
- [x] 4 quick_replies (passes), 5 (fails)
- [x] Memory values are non-string (numbers, objects) — formatMemories uses JSON.stringify
- [x] OPENAI_API_KEY missing → createLanguageModel returns err, NOT throws
- [x] generateObject throws → orchestrator catches and returns err

---

## Validation Commands

### Static Analysis
```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" run type-check
```
EXPECT: Exit 0, zero TypeScript errors

### Unit Tests
```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" test features/ai
```
EXPECT: All tests pass (13 assertions across 2 test files)

### Full Test Suite
```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" test
```
EXPECT: All tests pass, no regressions

### Build Check
```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" run build
```
EXPECT: Exit 0, routes unchanged from Phase 1 (/, /ai-community, /events/[id])

### Manual Validation
- [ ] `bun run type-check` exits 0 with 0 errors
- [ ] `bun test features/ai` shows all green
- [ ] `bun run build` exits 0
- [ ] `features/ai/index.ts` exports: `AIResponseSchema`, `AIResponse`, `runOrchestrator`, `toolRegistry`, `buildSystemPrompt`, `createLanguageModel`

---

## Acceptance Criteria
- [ ] All 9 files created/updated
- [ ] `bun run type-check` → exit 0, 0 errors
- [ ] `bun test features/ai` → all 13+ assertions pass
- [ ] `bun run build` → exit 0
- [ ] `features/ai/index.ts` exports all 5 modules
- [ ] No hardcoded API keys or credentials
- [ ] No `console.log` outside of `lib/logger/index.ts`

## Completion Checklist
- [ ] All async functions return `Result<T>`, never throw to callers
- [ ] Every function calls `logger.debug/info/error` with context object
- [ ] Tool stubs log their name + inputs at debug level
- [ ] `generateObject` called with `schema:` NOT `output:`
- [ ] `tool()` used with `inputSchema:` NOT `parameters:`
- [ ] Tests use `from 'bun:test'` NOT `from 'vitest'` or `from '@jest/globals'`
- [ ] `approval_action` is nullable (not optional) in schema

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `LanguageModel` type incompatible with `openai()` return | M | Build fails | Cast via `as LanguageModel`; if fails try `as unknown as LanguageModel` |
| `ModelMessage` import name changed in v6 | M | Type errors | Use inline type `{ role: 'user' \| 'assistant' \| 'system'; content: string }[]`; if SDK accepts it, correct. Otherwise import `ModelMessage` from 'ai' |
| `generateObject` messages param type mismatch | M | Build fails | Cast `messages` via `as Parameters<typeof generateObject>[0]['messages']` |
| `tool()` execute type inference too strict | L | Build fails | Add explicit return type annotation on execute functions |
| bun test module resolution for `@/lib/*` path aliases | M | Tests fail | Add `tsconfig.json` path check; if needed, use relative imports in test files only |

## Notes
- Phase 2 is a pure service/logic layer. Zero UI, zero API routes, zero Supabase writes.
- The orchestrator calls `generateObject` (non-streaming). Phase 5 will use `streamObject` in the API route for the streaming chat experience.
- Tool execute stubs intentionally return empty arrays — they will NOT be called during Phase 2 tests. Phase 5 replaces them with real service calls.
- `MessageInput` type in `ai-orchestrator.ts` is a simplified local type (not importing from SDK) to avoid version-specific type issues. Phase 5 can tighten this to the SDK's `ModelMessage` type.
- The `usage` token field names are handled defensively because Vercel AI SDK has renamed these between v3 and v6 (`promptTokens` → `inputTokens`).
