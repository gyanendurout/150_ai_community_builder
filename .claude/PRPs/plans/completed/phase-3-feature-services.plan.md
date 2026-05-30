# Plan: Phase 3 — Feature Services

## Summary
Implement the clean, typed service + repository layer for all 8 feature domains: events, memory, drafts, approvals, courts, weather, audit, and notifications. Every service returns `Result<T>`, uses the Supabase service-role client, and never swallows errors. Repositories are thin Supabase wrappers that throw on DB errors. Services catch those throws and convert to typed `Result<T>` failures. Unit tests use constructor injection to pass mock repositories.

## User Story
As the AI orchestrator and Chat API route (Phase 5), I want typed, safe service methods for every domain so that I can create events, persist drafts, manage approvals, and log actions without writing raw Supabase queries in the route handler.

## Problem → Solution
Stub index files with TODO comments → Complete service + repository layer that the orchestrator and API route can import and call directly.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/ai-community-assistant-platform.prd.md`
- **PRD Phase**: Phase 3 — Feature Services
- **Estimated Files**: 29 (14 source, 7 test, 8 index updates)

---

## UX Design

N/A — internal change, no user-facing UX transformation.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/errors.ts` | all | `Result<T>`, `ok()`, `err()` — EVERY service method returns this |
| P0 | `lib/supabase/types.ts` | all | All Row/Insert/Update types used as parameters and returns |
| P0 | `lib/supabase/server.ts` | all | `createServiceClient()` — the only Supabase client to use in Phase 3 |
| P0 | `features/ai/ai-orchestrator.ts` | all | Pattern for Result<T> usage — mirror exactly |
| P0 | `features/ai/model-provider.ts` | all | Pattern for service class using Result<T> |
| P1 | `lib/logger/index.ts` | all | Logging pattern — `logger.info/debug/error` with context object |
| P1 | `features/events/event.types.ts` | all | `EventDraft`, `getEventDraftCompletionPercentage`, `getMissingEventFields` |
| P1 | `lib/constants.ts` | all | `DEMO_USER_ID`, type constants |
| P2 | `features/ai/__tests__/structured-output-schema.test.ts` | all | Test pattern to mirror: describe/test/expect from bun:test |

## External Documentation

No external research needed — feature uses established internal patterns (Supabase JS client, Result<T> pattern, bun:test).

---

## Patterns to Mirror

### RESULT_TYPE_PATTERN
```typescript
// SOURCE: lib/errors.ts:12-22, features/ai/model-provider.ts:20-33
import { ok, err, type Result } from '@/lib/errors'

export async function doSomething(): Promise<Result<SomeRow>> {
  try {
    const row = await this.repo.findById(id)
    if (!row) return err('Not found', 'NOT_FOUND', 404)
    return ok(row)
  } catch (e) {
    logger.error('doSomething failed', { error: String(e) })
    return err('Failed to do something', 'SOMETHING_FAILED', 500)
  }
}
```

### SERVICE_CONSTRUCTOR_INJECTION
```typescript
// SOURCE: features/ai/model-provider.ts (pattern adapted)
// Constructor injection enables test mocking without module-level mock.module()
export class EventService {
  constructor(private readonly repo: EventRepository = new EventRepository()) {}
}
// In tests: new EventService({ insert: mock(...), findById: mock(...) } as unknown as EventRepository)
```

### REPOSITORY_PATTERN
```typescript
// Pattern to follow for ALL repositories:
export class FooRepository {
  private client = createServiceClient()    // one client per instance

  async insert(data: FooInsert): Promise<FooRow> {
    const { data: row, error } = await this.client
      .from('foo_table')
      .insert(data)
      .select()
      .single()                             // single() for inserts — throws if 0/multiple
    if (error) throw new Error(error.message)
    return row
  }

  async findById(id: string): Promise<FooRow | null> {
    const { data, error } = await this.client
      .from('foo_table')
      .select('*')
      .eq('id', id)
      .maybeSingle()                        // maybeSingle() for lookups — null if missing
    if (error) throw new Error(error.message)
    return data
  }
}
```

### LOGGING_PATTERN
```typescript
// SOURCE: lib/logger/index.ts, features/ai/ai-orchestrator.ts:27-31
logger.info('ServiceName.methodName', { userId, relevantId })   // service entry
logger.debug('ServiceName.methodName', { details })              // repo calls
logger.error('ServiceName.methodName failed', { error: String(e) }) // catch
```

### ERROR_CODES_PATTERN
```typescript
// SOURCE: features/ai/model-provider.ts:24-27
// ERROR CODE FORMAT: NOUN_VERB_FAILED | NOUN_NOT_FOUND | NOUN_VALIDATION_ERROR
err('Event not found', 'EVENT_NOT_FOUND', 404)
err('Failed to create event', 'EVENT_CREATE_FAILED', 500)
err('Invalid event data', 'VALIDATION_ERROR', 400)
```

### ZOD_SCHEMA_PATTERN
```typescript
// SOURCE: features/ai/structured-output-schema.ts:38-44 (Zod v4 required)
// Zod v4: z.record() requires 2 args: z.record(z.string(), z.unknown())
// nullable != optional: .nullable() allows null, .optional() allows undefined
// For DB insert schemas: use .optional() for fields with DB defaults, .nullable() for fields that accept null writes
import { z } from 'zod'
export const FooInsertSchema = z.object({
  required_field: z.string().min(1),
  nullable_no_default: z.string().nullable(),         // must pass null explicitly
  optional_with_default: z.string().default('value'), // DB default covers missing
})
```

### TEST_PATTERN
```typescript
// SOURCE: features/ai/__tests__/structured-output-schema.test.ts:1-14
import { describe, test, expect, mock } from 'bun:test'

describe('ServiceName', () => {
  const mockRow = { id: 'test-uuid', ... }

  const buildMockRepo = (overrides = {}) => ({
    insert: mock(async () => mockRow),
    findById: mock(async () => mockRow),
    findByOrganizer: mock(async () => [mockRow]),
    ...overrides,
  })

  test('creates entity successfully', async () => {
    const service = new MyService(buildMockRepo() as unknown as MyRepository)
    const result = await service.create(validInput)
    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('test-uuid')
  })
})
```

### SUPABASE_UPDATE_PATTERN
```typescript
// Supabase update — chain .eq() then .select().single()
async update(id: string, data: Partial<FooInsert>): Promise<FooRow> {
  const { data: row, error } = await this.client
    .from('foo_table')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `features/events/event.schema.ts` | CREATE | Zod EventInsertSchema for validation in EventService |
| `features/events/event.repository.ts` | CREATE | Supabase CRUD for events table |
| `features/events/event.service.ts` | CREATE | create/get/list business logic |
| `features/events/index.ts` | UPDATE | Add barrel exports for service, repo, schema |
| `features/memory/memory.repository.ts` | CREATE | Supabase CRUD for user_memory table |
| `features/memory/memory.service.ts` | CREATE | getMemories by user + optional keys |
| `features/memory/index.ts` | UPDATE | Barrel exports |
| `features/drafts/draft.repository.ts` | CREATE | Supabase CRUD for drafts table |
| `features/drafts/draft.service.ts` | CREATE | create/update/getByConversation |
| `features/drafts/index.ts` | UPDATE | Barrel exports |
| `features/approvals/approval.repository.ts` | CREATE | Supabase CRUD for approvals table |
| `features/approvals/approval.service.ts` | CREATE | create/approve/reject |
| `features/approvals/index.ts` | UPDATE | Barrel exports |
| `features/courts/court.repository.ts` | CREATE | Supabase CRUD for courts table |
| `features/courts/court.service.ts` | CREATE | listCourts/getCourt |
| `features/courts/index.ts` | UPDATE | Barrel exports |
| `features/weather/weather.service.ts` | CREATE | Stub — always returns sunny 22°C |
| `features/weather/index.ts` | UPDATE | Barrel exports |
| `features/audit/audit.service.ts` | CREATE | log(entry) → inserts into audit_logs |
| `features/audit/index.ts` | UPDATE | Barrel exports |
| `features/notifications/notification.service.ts` | CREATE | Stub — logs but doesn't send |
| `features/notifications/index.ts` | UPDATE | Barrel exports |
| `features/events/__tests__/event.service.test.ts` | CREATE | Unit tests for EventService |
| `features/memory/__tests__/memory.service.test.ts` | CREATE | Unit tests for MemoryService |
| `features/drafts/__tests__/draft.service.test.ts` | CREATE | Unit tests for DraftService |
| `features/approvals/__tests__/approval.service.test.ts` | CREATE | Unit tests for ApprovalService |
| `features/courts/__tests__/court.service.test.ts` | CREATE | Unit tests for CourtService |
| `features/weather/__tests__/weather.service.test.ts` | CREATE | Unit tests for WeatherService |
| `features/audit/__tests__/audit.service.test.ts` | CREATE | Unit tests for AuditService |

## NOT Building
- Profile service (Phase 3 scope explicitly excludes it — profiles is a stub only)
- Tournament service (Phase 4)
- Conversation / message services (Phase 5 — created in the chat API route)
- Real weather API integration (stub only for POC)
- Real notification sending (stub only for POC)
- Integration tests against real Supabase (unit tests with mock repos only)
- Supabase realtime subscriptions (Phase 5+)

---

## Step-by-Step Tasks

### Task 1: Event schema + repository
- **ACTION**: Create `features/events/event.schema.ts` and `features/events/event.repository.ts`
- **IMPLEMENT**:
  ```typescript
  // event.schema.ts
  import { z } from 'zod'

  export const EventInsertSchema = z.object({
    organizer_id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
    event_type: z.enum(['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament']).optional().nullable(),
    sport_type: z.string().default('pickleball'),
    start_at: z.string(),
    end_at: z.string().optional().nullable(),
    timezone: z.string().default('UTC'),
    court_id: z.string().uuid().optional().nullable(),
    location_name: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    player_capacity: z.number().int().positive(),
    visibility: z.enum(['public', 'private', 'invite_only']).default('public'),
    status: z.enum(['draft', 'published', 'cancelled', 'completed']).default('published'),
    source: z.enum(['ai_chat', 'manual', 'import']).default('ai_chat'),
    created_from_conversation_id: z.string().uuid().optional().nullable(),
  })
  export type EventInsertInput = z.infer<typeof EventInsertSchema>
  ```
  ```typescript
  // event.repository.ts
  import { createServiceClient } from '@/lib/supabase/server'
  import type { EventInsert, EventRow } from '@/lib/supabase/types'

  export class EventRepository {
    private client = createServiceClient()

    async insert(data: EventInsert): Promise<EventRow> {
      const { data: row, error } = await this.client
        .from('events')
        .insert(data)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }

    async findById(id: string): Promise<EventRow | null> {
      const { data, error } = await this.client
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    }

    async findByOrganizer(organizerId: string): Promise<EventRow[]> {
      const { data, error } = await this.client
        .from('events')
        .select('*')
        .eq('organizer_id', organizerId)
        .order('start_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    }
  }
  ```
- **MIRROR**: REPOSITORY_PATTERN, ZOD_SCHEMA_PATTERN
- **IMPORTS**: `createServiceClient` from `@/lib/supabase/server`; `EventInsert`, `EventRow` from `@/lib/supabase/types`; `z` from `zod`
- **GOTCHA**: Use `.maybeSingle()` for lookups (returns null when not found), `.single()` for inserts (throws if insert fails to return a row). NEVER use `.single()` for lookups — it throws a `PGRST116` error when 0 rows are returned.
- **VALIDATE**: `bun run type-check` — zero errors

### Task 2: EventService
- **ACTION**: Create `features/events/event.service.ts`
- **IMPLEMENT**:
  ```typescript
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import type { EventRow } from '@/lib/supabase/types'
  import { EventInsertSchema } from './event.schema'
  import { EventRepository } from './event.repository'

  export class EventService {
    constructor(private readonly repo: EventRepository = new EventRepository()) {}

    async createEvent(data: unknown): Promise<Result<EventRow>> {
      logger.info('EventService.createEvent start')
      const validated = EventInsertSchema.safeParse(data)
      if (!validated.success) {
        logger.warn('EventService.createEvent validation failed', { issues: validated.error.issues.map(i => i.message) })
        return err('Invalid event data', 'VALIDATION_ERROR', 400)
      }
      try {
        const row = await this.repo.insert(validated.data)
        logger.info('EventService.createEvent succeeded', { id: row.id })
        return ok(row)
      } catch (e) {
        logger.error('EventService.createEvent failed', { error: String(e) })
        return err('Failed to create event', 'EVENT_CREATE_FAILED', 500)
      }
    }

    async getEvent(id: string): Promise<Result<EventRow>> {
      try {
        const row = await this.repo.findById(id)
        if (!row) return err('Event not found', 'EVENT_NOT_FOUND', 404)
        return ok(row)
      } catch (e) {
        logger.error('EventService.getEvent failed', { id, error: String(e) })
        return err('Failed to fetch event', 'EVENT_FETCH_FAILED', 500)
      }
    }

    async listEvents(organizerId: string): Promise<Result<EventRow[]>> {
      try {
        const rows = await this.repo.findByOrganizer(organizerId)
        return ok(rows)
      } catch (e) {
        logger.error('EventService.listEvents failed', { organizerId, error: String(e) })
        return err('Failed to list events', 'EVENT_LIST_FAILED', 500)
      }
    }
  }
  ```
- **MIRROR**: RESULT_TYPE_PATTERN, SERVICE_CONSTRUCTOR_INJECTION, LOGGING_PATTERN, ERROR_CODES_PATTERN
- **IMPORTS**: `logger` from `@/lib/logger`; `ok`, `err`, `Result` from `@/lib/errors`; `EventRow` from `@/lib/supabase/types`; `EventInsertSchema` from `./event.schema`; `EventRepository` from `./event.repository`
- **GOTCHA**: `createEvent` accepts `unknown` (not typed insert) because the input comes from AI tool output (untyped JSON) — Zod validates it. This is intentional.
- **VALIDATE**: `bun run type-check`

### Task 3: Memory repository + service
- **ACTION**: Create `features/memory/memory.repository.ts` and `features/memory/memory.service.ts`
- **IMPLEMENT**:
  ```typescript
  // memory.repository.ts
  import { createServiceClient } from '@/lib/supabase/server'
  import type { UserMemoryRow } from '@/lib/supabase/types'

  export class MemoryRepository {
    private client = createServiceClient()

    async findByUser(userId: string): Promise<UserMemoryRow[]> {
      const { data, error } = await this.client
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .order('confidence_score', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    }

    async findByUserAndKeys(userId: string, keys: string[]): Promise<UserMemoryRow[]> {
      const { data, error } = await this.client
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .in('memory_key', keys)
      if (error) throw new Error(error.message)
      return data ?? []
    }
  }
  ```
  ```typescript
  // memory.service.ts
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import type { UserMemoryRow } from '@/lib/supabase/types'
  import { MemoryRepository } from './memory.repository'

  export class MemoryService {
    constructor(private readonly repo: MemoryRepository = new MemoryRepository()) {}

    async getMemories(userId: string, keys?: string[]): Promise<Result<UserMemoryRow[]>> {
      logger.debug('MemoryService.getMemories', { userId, keyCount: keys?.length })
      try {
        const rows = keys && keys.length > 0
          ? await this.repo.findByUserAndKeys(userId, keys)
          : await this.repo.findByUser(userId)
        return ok(rows)
      } catch (e) {
        logger.error('MemoryService.getMemories failed', { userId, error: String(e) })
        return err('Failed to fetch memories', 'MEMORY_FETCH_FAILED', 500)
      }
    }
  }
  ```
- **MIRROR**: REPOSITORY_PATTERN, RESULT_TYPE_PATTERN, SERVICE_CONSTRUCTOR_INJECTION
- **IMPORTS**: `createServiceClient` from `@/lib/supabase/server`; `UserMemoryRow` from `@/lib/supabase/types`
- **GOTCHA**: `findByUserAndKeys` uses `.in('memory_key', keys)` — this is Supabase's `IN` query; works correctly with an array of strings. Empty `keys` array should fall back to `findByUser` (handled in service layer check `keys && keys.length > 0`).
- **VALIDATE**: `bun run type-check`

### Task 4: Draft repository + service
- **ACTION**: Create `features/drafts/draft.repository.ts` and `features/drafts/draft.service.ts`
- **IMPLEMENT**:
  ```typescript
  // draft.repository.ts
  import { createServiceClient } from '@/lib/supabase/server'
  import type { DraftInsert, DraftRow } from '@/lib/supabase/types'

  export class DraftRepository {
    private client = createServiceClient()

    async insert(data: DraftInsert): Promise<DraftRow> {
      const { data: row, error } = await this.client
        .from('drafts')
        .insert(data)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }

    async update(id: string, data: Partial<DraftInsert>): Promise<DraftRow> {
      const { data: row, error } = await this.client
        .from('drafts')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }

    async findById(id: string): Promise<DraftRow | null> {
      const { data, error } = await this.client
        .from('drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    }

    async findByConversation(conversationId: string): Promise<DraftRow | null> {
      const { data, error } = await this.client
        .from('drafts')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('entity_type', 'event')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    }
  }
  ```
  ```typescript
  // draft.service.ts
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import type { DraftInsert, DraftRow } from '@/lib/supabase/types'
  import type { EventDraft } from '@/features/events/event.types'
  import { getEventDraftCompletionPercentage, getMissingEventFields } from '@/features/events/event.types'
  import { DraftRepository } from './draft.repository'

  export class DraftService {
    constructor(private readonly repo: DraftRepository = new DraftRepository()) {}

    async createDraft(data: DraftInsert): Promise<Result<DraftRow>> {
      logger.info('DraftService.createDraft', { userId: data.user_id, entityType: data.entity_type })
      try {
        const row = await this.repo.insert(data)
        return ok(row)
      } catch (e) {
        logger.error('DraftService.createDraft failed', { error: String(e) })
        return err('Failed to create draft', 'DRAFT_CREATE_FAILED', 500)
      }
    }

    async updateDraft(id: string, updates: EventDraft): Promise<Result<DraftRow>> {
      logger.info('DraftService.updateDraft', { id })
      try {
        const existing = await this.repo.findById(id)
        if (!existing) return err('Draft not found', 'DRAFT_NOT_FOUND', 404)
        const mergedDraft = { ...(existing.draft_json as EventDraft), ...updates }
        const row = await this.repo.update(id, {
          draft_json: mergedDraft,
          completion_percentage: getEventDraftCompletionPercentage(mergedDraft),
          missing_fields_json: getMissingEventFields(mergedDraft),
        })
        return ok(row)
      } catch (e) {
        logger.error('DraftService.updateDraft failed', { id, error: String(e) })
        return err('Failed to update draft', 'DRAFT_UPDATE_FAILED', 500)
      }
    }

    async getDraftByConversation(conversationId: string): Promise<Result<DraftRow | null>> {
      try {
        const row = await this.repo.findByConversation(conversationId)
        return ok(row)
      } catch (e) {
        logger.error('DraftService.getDraftByConversation failed', { conversationId, error: String(e) })
        return err('Failed to fetch draft', 'DRAFT_FETCH_FAILED', 500)
      }
    }
  }
  ```
- **MIRROR**: REPOSITORY_PATTERN, RESULT_TYPE_PATTERN, SERVICE_CONSTRUCTOR_INJECTION
- **IMPORTS**: `DraftInsert`, `DraftRow` from `@/lib/supabase/types`; `EventDraft`, `getEventDraftCompletionPercentage`, `getMissingEventFields` from `@/features/events/event.types`
- **GOTCHA**: `DraftRow.draft_json` is typed as `Json` (broad type). When reading it back for merge, cast as `EventDraft`: `(existing.draft_json as EventDraft)`. This is intentional — the schema is enforced at write time. `DraftRow.missing_fields_json` is also `Json` — pass `getMissingEventFields()` result (a `string[]`) directly; TypeScript accepts `string[]` where `Json` is expected because `string[]` satisfies `Json[]`.
- **VALIDATE**: `bun run type-check`

### Task 5: Approval repository + service
- **ACTION**: Create `features/approvals/approval.repository.ts` and `features/approvals/approval.service.ts`
- **IMPLEMENT**:
  ```typescript
  // approval.repository.ts
  import { createServiceClient } from '@/lib/supabase/server'
  import type { ApprovalInsert, ApprovalRow } from '@/lib/supabase/types'

  export class ApprovalRepository {
    private client = createServiceClient()

    async insert(data: ApprovalInsert): Promise<ApprovalRow> {
      const { data: row, error } = await this.client
        .from('approvals')
        .insert(data)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }

    async update(id: string, data: Partial<ApprovalInsert>): Promise<ApprovalRow> {
      const { data: row, error } = await this.client
        .from('approvals')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }

    async findById(id: string): Promise<ApprovalRow | null> {
      const { data, error } = await this.client
        .from('approvals')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    }
  }
  ```
  ```typescript
  // approval.service.ts
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import type { ApprovalInsert, ApprovalRow } from '@/lib/supabase/types'
  import { ApprovalRepository } from './approval.repository'

  export class ApprovalService {
    constructor(private readonly repo: ApprovalRepository = new ApprovalRepository()) {}

    async createApproval(data: ApprovalInsert): Promise<Result<ApprovalRow>> {
      logger.info('ApprovalService.createApproval', { userId: data.user_id, actionType: data.action_type })
      try {
        const row = await this.repo.insert(data)
        return ok(row)
      } catch (e) {
        logger.error('ApprovalService.createApproval failed', { error: String(e) })
        return err('Failed to create approval', 'APPROVAL_CREATE_FAILED', 500)
      }
    }

    async approve(id: string): Promise<Result<ApprovalRow>> {
      logger.info('ApprovalService.approve', { id })
      try {
        const existing = await this.repo.findById(id)
        if (!existing) return err('Approval not found', 'APPROVAL_NOT_FOUND', 404)
        if (existing.status !== 'pending') return err('Approval is not pending', 'APPROVAL_NOT_PENDING', 400)
        const row = await this.repo.update(id, {
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        return ok(row)
      } catch (e) {
        logger.error('ApprovalService.approve failed', { id, error: String(e) })
        return err('Failed to approve', 'APPROVAL_APPROVE_FAILED', 500)
      }
    }

    async reject(id: string): Promise<Result<ApprovalRow>> {
      logger.info('ApprovalService.reject', { id })
      try {
        const existing = await this.repo.findById(id)
        if (!existing) return err('Approval not found', 'APPROVAL_NOT_FOUND', 404)
        if (existing.status !== 'pending') return err('Approval is not pending', 'APPROVAL_NOT_PENDING', 400)
        const row = await this.repo.update(id, {
          status: 'rejected',
          rejected_at: new Date().toISOString(),
        })
        return ok(row)
      } catch (e) {
        logger.error('ApprovalService.reject failed', { id, error: String(e) })
        return err('Failed to reject', 'APPROVAL_REJECT_FAILED', 500)
      }
    }
  }
  ```
- **MIRROR**: REPOSITORY_PATTERN, RESULT_TYPE_PATTERN, SUPABASE_UPDATE_PATTERN
- **IMPORTS**: `ApprovalInsert`, `ApprovalRow` from `@/lib/supabase/types`
- **GOTCHA**: `approvals` table `action_type` has 6 values: `'create_event' | 'send_invites' | 'publish_tournament' | 'save_profile' | 'send_message' | 'process_refund'`. The `AIResponseSchema.approval_action` only has 4. When creating approvals from AI response, only the 4 AI-exposed types will be used. Type check will pass because `'create_event'` is in both enums. Do NOT call `repo.update()` without first calling `repo.findById()` — always validate existing state before mutation.
- **VALIDATE**: `bun run type-check`

### Task 6: Court repository + service
- **ACTION**: Create `features/courts/court.repository.ts` and `features/courts/court.service.ts`
- **IMPLEMENT**:
  ```typescript
  // court.repository.ts
  import { createServiceClient } from '@/lib/supabase/server'
  import type { CourtRow } from '@/lib/supabase/types'

  export class CourtRepository {
    private client = createServiceClient()

    async findAll(): Promise<CourtRow[]> {
      const { data, error } = await this.client
        .from('courts')
        .select('*')
        .order('name')
      if (error) throw new Error(error.message)
      return data ?? []
    }

    async findById(id: string): Promise<CourtRow | null> {
      const { data, error } = await this.client
        .from('courts')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    }
  }
  ```
  ```typescript
  // court.service.ts
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import type { CourtRow } from '@/lib/supabase/types'
  import { CourtRepository } from './court.repository'

  export class CourtService {
    constructor(private readonly repo: CourtRepository = new CourtRepository()) {}

    async listCourts(): Promise<Result<CourtRow[]>> {
      logger.debug('CourtService.listCourts')
      try {
        const rows = await this.repo.findAll()
        return ok(rows)
      } catch (e) {
        logger.error('CourtService.listCourts failed', { error: String(e) })
        return err('Failed to fetch courts', 'COURT_FETCH_FAILED', 500)
      }
    }

    async getCourt(id: string): Promise<Result<CourtRow>> {
      try {
        const row = await this.repo.findById(id)
        if (!row) return err('Court not found', 'COURT_NOT_FOUND', 404)
        return ok(row)
      } catch (e) {
        logger.error('CourtService.getCourt failed', { id, error: String(e) })
        return err('Failed to fetch court', 'COURT_FETCH_FAILED', 500)
      }
    }
  }
  ```
- **MIRROR**: REPOSITORY_PATTERN, RESULT_TYPE_PATTERN
- **IMPORTS**: `CourtRow` from `@/lib/supabase/types`
- **GOTCHA**: Courts are seeded static data — no insert/update needed in Phase 3. The 5 seeded courts from `supabase/seed.sql` will be returned by `findAll()`.
- **VALIDATE**: `bun run type-check`

### Task 7: Weather service (stub)
- **ACTION**: Create `features/weather/weather.service.ts`
- **IMPLEMENT**:
  ```typescript
  import { logger } from '@/lib/logger'
  import { ok, type Result } from '@/lib/errors'

  export type WeatherForecast = {
    date: string
    condition: string
    temp_c: number
    suitable_for_outdoor: boolean
    description: string
  }

  export class WeatherService {
    async getForecast(date: string, _location?: string): Promise<Result<WeatherForecast>> {
      logger.debug('WeatherService.getForecast (stub)', { date })
      return ok({
        date,
        condition: 'Sunny',
        temp_c: 22,
        suitable_for_outdoor: true,
        description: 'Great day for pickleball!',
      })
    }
  }
  ```
- **MIRROR**: RESULT_TYPE_PATTERN, LOGGING_PATTERN
- **IMPORTS**: `logger` from `@/lib/logger`; `ok`, `Result` from `@/lib/errors`
- **GOTCHA**: No `err` import needed — this stub always succeeds. Prefix unused `_location` param with underscore to suppress TypeScript `noUnusedParameters` warnings (if enabled). Stub comment in log message is intentional — removes ambiguity during debugging.
- **VALIDATE**: `bun run type-check`

### Task 8: Audit service
- **ACTION**: Create `features/audit/audit.service.ts`
- **IMPLEMENT**:
  ```typescript
  import { logger } from '@/lib/logger'
  import { ok, err, type Result } from '@/lib/errors'
  import type { AuditLogInsert } from '@/lib/supabase/types'
  import { createServiceClient } from '@/lib/supabase/server'

  export class AuditService {
    private get client() { return createServiceClient() }

    async log(entry: Omit<AuditLogInsert, 'id' | 'created_at'>): Promise<Result<void>> {
      logger.info('AuditService.log', {
        action: entry.action,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
      })
      try {
        const { error } = await this.client
          .from('audit_logs')
          .insert(entry)
        if (error) throw new Error(error.message)
        return ok(undefined)
      } catch (e) {
        logger.error('AuditService.log failed', { error: String(e) })
        return err('Failed to write audit log', 'AUDIT_LOG_FAILED', 500)
      }
    }
  }
  ```
- **MIRROR**: RESULT_TYPE_PATTERN, LOGGING_PATTERN
- **IMPORTS**: `AuditLogInsert` from `@/lib/supabase/types`; `createServiceClient` from `@/lib/supabase/server`
- **GOTCHA**: `AuditLogInsert.Update` is typed as `never` in `lib/supabase/types.ts` — audit logs are append-only (no update method needed). Use `private get client()` (getter) instead of `private client =` (field init) — this avoids a module-level Supabase client being instantiated at import time, which can fail in test environments where env vars are not set. `ok(undefined)` returns `Result<void>` — the calling pattern is `const result = await auditService.log(...)` with `if (result.error)` check.
- **VALIDATE**: `bun run type-check`

### Task 9: Notification service (stub)
- **ACTION**: Create `features/notifications/notification.service.ts`
- **IMPLEMENT**:
  ```typescript
  import { logger } from '@/lib/logger'
  import { ok, type Result } from '@/lib/errors'

  export class NotificationService {
    async sendEventInvite(_eventId: string, _recipientIds: string[]): Promise<Result<void>> {
      logger.info('NotificationService.sendEventInvite (stub — invites not sent in POC)', {
        eventId: _eventId,
        recipientCount: _recipientIds.length,
      })
      return ok(undefined)
    }
  }
  ```
- **MIRROR**: RESULT_TYPE_PATTERN
- **GOTCHA**: Prefix unused params with underscore. This is a stub — real implementation is Phase 2+. Keep it minimal.
- **VALIDATE**: `bun run type-check`

### Task 10: Update all index.ts barrel exports
- **ACTION**: Replace stub comments in all 8 `index.ts` files with proper barrel exports
- **IMPLEMENT**:

  `features/events/index.ts`:
  ```typescript
  export * from './event.types'
  export * from './event.schema'
  export * from './event.repository'
  export * from './event.service'
  ```

  `features/memory/index.ts`:
  ```typescript
  export * from './memory.repository'
  export * from './memory.service'
  ```

  `features/drafts/index.ts`:
  ```typescript
  export * from './draft.repository'
  export * from './draft.service'
  ```

  `features/approvals/index.ts`:
  ```typescript
  export * from './approval.repository'
  export * from './approval.service'
  ```

  `features/courts/index.ts`:
  ```typescript
  export * from './court.repository'
  export * from './court.service'
  ```

  `features/weather/index.ts`:
  ```typescript
  export * from './weather.service'
  ```

  `features/audit/index.ts`:
  ```typescript
  export * from './audit.service'
  ```

  `features/notifications/index.ts`:
  ```typescript
  export * from './notification.service'
  ```

- **MIRROR**: `features/events/index.ts` current pattern: `export * from './event.types'`
- **GOTCHA**: Do NOT export `EventInsertInput` from `event.schema.ts` if it conflicts with `EventInsert` from `@/lib/supabase/types`. Since they are different names (`EventInsertInput` vs `EventInsert`), this is fine. However, if any type names collide across files (e.g., a `DraftStatus` in both `event.types.ts` and `draft.service.ts`), rename the conflicting one.
- **VALIDATE**: `bun run type-check`

### Task 11: Write unit tests for all services
- **ACTION**: Create 7 test files, one per service module that has business logic
- **IMPLEMENT** (abbreviated — full structure for each):

  `features/events/__tests__/event.service.test.ts`:
  ```typescript
  import { describe, test, expect, mock } from 'bun:test'
  import { EventService } from '../event.service'
  import type { EventRepository } from '../event.repository'

  const MOCK_EVENT_ROW = {
    id: '11111111-1111-1111-1111-111111111111',
    organizer_id: '00000000-0000-0000-0000-000000000001',
    title: 'Saturday Doubles',
    description: null,
    event_type: 'doubles' as const,
    sport_type: 'pickleball',
    start_at: '2026-06-07T09:00:00.000Z',
    end_at: null,
    timezone: 'UTC',
    court_id: null,
    location_name: null,
    address: null,
    latitude: null,
    longitude: null,
    player_capacity: 8,
    visibility: 'public' as const,
    status: 'published' as const,
    source: 'ai_chat' as const,
    created_from_conversation_id: null,
    created_at: '2026-05-30T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
  }

  const VALID_INPUT = {
    organizer_id: '00000000-0000-0000-0000-000000000001',
    title: 'Saturday Doubles',
    start_at: '2026-06-07T09:00:00.000Z',
    player_capacity: 8,
  }

  const buildMockRepo = (overrides: Partial<EventRepository> = {}) => ({
    insert: mock(async () => MOCK_EVENT_ROW),
    findById: mock(async () => MOCK_EVENT_ROW),
    findByOrganizer: mock(async () => [MOCK_EVENT_ROW]),
    ...overrides,
  })

  describe('EventService', () => {
    test('createEvent returns ok with created row', async () => {
      const service = new EventService(buildMockRepo() as unknown as EventRepository)
      const result = await service.createEvent(VALID_INPUT)
      expect(result.error).toBeNull()
      expect(result.data?.title).toBe('Saturday Doubles')
    })

    test('createEvent returns VALIDATION_ERROR for missing required fields', async () => {
      const service = new EventService(buildMockRepo() as unknown as EventRepository)
      const result = await service.createEvent({ title: 'No start_at' })
      expect(result.data).toBeNull()
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    test('createEvent returns VALIDATION_ERROR for negative player_capacity', async () => {
      const service = new EventService(buildMockRepo() as unknown as EventRepository)
      const result = await service.createEvent({ ...VALID_INPUT, player_capacity: -1 })
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    test('getEvent returns EVENT_NOT_FOUND when repo returns null', async () => {
      const service = new EventService(buildMockRepo({ findById: mock(async () => null) }) as unknown as EventRepository)
      const result = await service.getEvent('non-existent-id')
      expect(result.error?.code).toBe('EVENT_NOT_FOUND')
      expect(result.error?.statusCode).toBe(404)
    })

    test('getEvent returns ok when event exists', async () => {
      const service = new EventService(buildMockRepo() as unknown as EventRepository)
      const result = await service.getEvent('11111111-1111-1111-1111-111111111111')
      expect(result.data?.id).toBe('11111111-1111-1111-1111-111111111111')
    })

    test('listEvents returns array of events', async () => {
      const service = new EventService(buildMockRepo() as unknown as EventRepository)
      const result = await service.listEvents('00000000-0000-0000-0000-000000000001')
      expect(result.error).toBeNull()
      expect(Array.isArray(result.data)).toBe(true)
    })

    test('createEvent returns EVENT_CREATE_FAILED when repo throws', async () => {
      const service = new EventService(buildMockRepo({ insert: mock(async () => { throw new Error('DB error') }) }) as unknown as EventRepository)
      const result = await service.createEvent(VALID_INPUT)
      expect(result.error?.code).toBe('EVENT_CREATE_FAILED')
    })
  })
  ```

  Follow the same pattern for the other 6 test files. Key tests per service:

  **memory.service.test.ts** (5 tests):
  - `getMemories returns all memories when no keys provided`
  - `getMemories filters by keys when provided`
  - `getMemories returns empty array when user has no memories`
  - `getMemories returns MEMORY_FETCH_FAILED when repo throws`
  - `getMemories passes empty array check (keys=[] falls back to findByUser)`

  **draft.service.test.ts** (5 tests):
  - `createDraft returns ok with draft row`
  - `updateDraft merges fields into existing draft_json`
  - `updateDraft returns DRAFT_NOT_FOUND when draft missing`
  - `getDraftByConversation returns null when no draft exists`
  - `updateDraft recalculates completion_percentage`

  **approval.service.test.ts** (5 tests):
  - `createApproval returns ok with pending status`
  - `approve transitions status to approved`
  - `approve returns APPROVAL_NOT_FOUND for missing approval`
  - `approve returns APPROVAL_NOT_PENDING when already approved`
  - `reject transitions status to rejected`

  **court.service.test.ts** (4 tests):
  - `listCourts returns all courts`
  - `getCourt returns specific court by id`
  - `getCourt returns COURT_NOT_FOUND for missing id`
  - `listCourts returns empty array when no courts seeded`

  **weather.service.test.ts** (3 tests):
  - `getForecast always returns ok (stub)`
  - `getForecast returns sunny forecast`
  - `getForecast passes through the date param`

  **audit.service.test.ts** (3 tests):
  - `log returns ok when insert succeeds`
  - `log includes action, entity_type, entity_id in entry`
  - `log returns AUDIT_LOG_FAILED when insert errors`

- **MIRROR**: TEST_PATTERN
- **IMPORTS**: All test files: `describe, test, expect, mock` from `bun:test`
- **GOTCHA**: The `mock()` function from `bun:test` returns a `Mock<T>` type. When passing `buildMockRepo() as unknown as EventRepository`, TypeScript is satisfied but bun's mock tracking still works. Do NOT use `jest.fn()` — this is bun, not jest. Do NOT use `vi.fn()` — wrong test runner. For AuditService, the client is created via `get client()` getter — mock at the module level using `mock.module('@/lib/supabase/server', ...)` OR restructure AuditService to accept an optional client factory for testability. Simplest approach: test only the error path by testing that `ok(undefined)` is returned for a successful case using a service that doesn't call the real DB in tests — mock the entire AuditService class if needed, or use `mock.module`.
- **VALIDATE**: `bun test features/` — all tests pass

### Task 12: Type-check, test, build
- **ACTION**: Run all validation levels
- **VALIDATE**:
  1. `bun run type-check` → exit 0, zero errors
  2. `bun test features/` → all tests green
  3. `bun run build` → exit 0, same route count as before

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| EventService.createEvent valid | complete valid object | `Result.data` is EventRow | No |
| EventService.createEvent missing title | `{ start_at, player_capacity }` | `Result.error.code = VALIDATION_ERROR` | Yes |
| EventService.createEvent negative capacity | `{ player_capacity: -1 }` | `Result.error.code = VALIDATION_ERROR` | Yes |
| EventService.getEvent not found | repo returns null | `Result.error.code = EVENT_NOT_FOUND, statusCode = 404` | Yes |
| EventService.createEvent DB error | repo.insert throws | `Result.error.code = EVENT_CREATE_FAILED` | Yes |
| MemoryService.getMemories no keys | `(userId)` | calls `findByUser`, returns array | No |
| MemoryService.getMemories with keys | `(userId, ['pref_court'])` | calls `findByUserAndKeys` | No |
| MemoryService.getMemories empty keys `[]` | `(userId, [])` | falls back to `findByUser` | Yes |
| DraftService.updateDraft not found | `('missing-id', updates)` | `DRAFT_NOT_FOUND` | Yes |
| ApprovalService.approve not pending | already approved approval | `APPROVAL_NOT_PENDING` | Yes |
| WeatherService.getForecast any | `('2026-06-07')` | `ok({ condition: 'Sunny' })` | No |

### Edge Cases Checklist
- [x] `getEvent` with non-existent UUID → 404
- [x] `createEvent` missing required fields → 400 validation error
- [x] `createEvent` invalid player_capacity (negative) → 400
- [x] `approve` on non-pending approval → 400
- [x] `reject` on non-pending approval → 400
- [x] `getMemories` with empty keys array → falls back to full user lookup
- [x] `updateDraft` on non-existent draft → 404
- [x] DB throw propagates as typed `err()` (not unhandled exception)

---

## Validation Commands

### Static Analysis
```bash
bun run type-check
```
EXPECT: Exit 0, zero errors

### Unit Tests (new services only)
```bash
bun test features/events features/memory features/drafts features/approvals features/courts features/weather features/audit features/notifications
```
EXPECT: All tests pass, ≥35 total test cases

### Full Test Suite (regression check)
```bash
bun test
```
EXPECT: All Phase 2 tests still pass, no regressions

### Build Check
```bash
bun run build
```
EXPECT: Exit 0, same 5 routes as before (no new routes in Phase 3)

### Manual Validation
- [ ] Confirm no imports of `createBrowserClient` (Phase 3 is server-only — must use `createServiceClient`)
- [ ] Confirm all services in `features/*/index.ts` are exported
- [ ] Confirm no raw `supabase.from()` calls in service files (only in repository files)

---

## Acceptance Criteria
- [ ] All 7 services created with full business logic
- [ ] All 7 repositories created as thin Supabase wrappers
- [ ] All 8 `index.ts` barrel exports updated
- [ ] ≥35 unit tests written and passing
- [ ] `bun run type-check` → exit 0
- [ ] `bun test` → all tests pass (Phase 2 tests still green)
- [ ] `bun run build` → exit 0

## Completion Checklist
- [ ] No service calls `createBrowserClient` (only `createServiceClient`)
- [ ] Every service method returns `Result<T>` — never throws to callers
- [ ] Every repository method throws on Supabase error (service catches it)
- [ ] Error codes follow NOUN_VERB_FAILED | NOUN_NOT_FOUND format
- [ ] All `mock()` calls use `bun:test`, not jest/vitest
- [ ] All test files excluded from tsc via `tsconfig.json` `exclude: ["**/__tests__/**"]`
- [ ] WeatherService and NotificationService clearly marked as stubs in log output

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AuditService test is tricky — getter-style client hard to mock | M | Low | Use `mock.module` OR just test the error path only |
| DraftRow.draft_json `Json` cast to `EventDraft` may lose type safety | L | Low | Cast is acceptable — enforced at write time; add JSDoc comment |
| `Partial<DraftInsert>` on repo.update — TypeScript may reject JSONB fields | M | Medium | If `missing_fields_json: string[]` fails, cast as `missing_fields_json: entry as Json` |
| Phase 2 bun test still passes after new test files added | L | Low | run `bun test` (all) before reporting done |

## Notes
- `AuditService` uses `private get client()` (getter) instead of `private client =` (field) to avoid instantiating Supabase client at module import time — important for test environments without env vars set.
- All services follow the same shape: constructor injection for repo, `Result<T>` returns, logger calls at info/debug/error levels. This makes them trivially interchangeable for testing and future dependency injection.
- `NotificationService` is a stub per PRD: "Real invite sending — mocked for POC, abstraction ready." Do not expand its scope.
- The `DraftService.updateDraft` merges with existing draft before recalculating completion — this supports partial updates (only pass the fields that changed).
- **SECURITY**: All services use `createServiceClient()` (service role). For Phase 5+, if multi-user auth is added, switch to session-based client. The comment in `lib/supabase/server.ts` already notes this.
- **Model config env vars added**: `OPENAI_MODEL_FAST=gpt-4o-mini` and `OPENAI_MODEL_SMART=gpt-4o` are now in `.env.local`. Phase 3 services do not use these but they are available for Phase 5's orchestrator config.
