# Plan: Phase 6 — E2E Flow + Detail Page

## Summary

Wire all Phase 2-5 work into the two user-facing pages (`/ai-community` and `/events/[id]`), fix a bug in the approval payload that causes the event to miss the final draft update, extend the chat API response with draft field data so the `LiveDraftPanel` can display live progress, and replace the boilerplate README with a project-specific setup guide.

## User Story

As a pickleball organizer, I want to open the chat, describe my event, watch the draft panel fill in real time, approve the event with one click, and land on the event detail page with correct data — so I can verify the event was created before sharing it.

## Problem → Solution

Placeholder pages (no hook wiring, no data fetch) → Fully connected pages where `useAIChat` drives the left column, `LiveDraftPanel` shows live field progress, `ApprovalCard` appears when the AI is ready, clicking Approve calls `POST /api/events` then redirects to `/events/{id}`, and the event detail page fetches and renders the created event.

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-community-assistant-platform.prd.md`
- **PRD Phase**: Phase 6 — E2E Flow + Detail Page
- **Estimated Files**: 6

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────┐
│  /ai-community: "Phase 4 UI coming soon"         │
│                                                  │
│  /events/[id]: "Phase 6 content coming soon"     │
│                                                  │
│  README: create-next-app boilerplate             │
└──────────────────────────────────────────────────┘
```

### After

```
┌─────────────────────────────────┬────────────────────────────────┐
│  CHAT COLUMN                    │  DRAFT PANEL                   │
│                                 │                                │
│  ┌──────────────────────────┐   │  Event Draft          67% ████ │
│  │ AI: Hi! What event…      │   │  ✓ Title: Saturday Doubles     │
│  └──────────────────────────┘   │  ✓ Type: Doubles               │
│     ┌──────────────────────┐    │  ✓ Players: 8                  │
│     │ User: Create doubles  │   │  ○ Date/Time  *                │
│     └──────────────────────┘    │  ○ Court                       │
│  ┌──────────────────────────┐   │  ○ Description                 │
│  │ AI: When is the event?   │   │                                │
│  └──────────────────────────┘   │  Still needed: start_at        │
│                                 │                                │
│  [This Saturday] [Sunday 10am]  │  — — — — — — — — — — — —      │
│                                 │  When ready:                   │
│  ┌──────────────────────────────┤  ╔══════════════════════════╗  │
│  │ Type a message…        [→]  ││  ║  Ready to Create          ║  │
│  └──────────────────────────────┤  ║  Saturday Doubles        ║  │
│                                 │  ║  Doubles | 8 players     ║  │
│                                 │  ║  [✓ Approve] [✕ Reject]  ║  │
└─────────────────────────────────╧══════════════════════════════╝
```

On Approve → redirect to `/events/{id}`:

```
┌────────────────────────────────────────────────────────┐
│  ← Back to chat                                        │
│                                                        │
│  Saturday Doubles                [Published]           │
│                                                        │
│  Title         Saturday Doubles                        │
│  Type          Doubles                                 │
│  Date          2026-06-07 09:00 UTC                    │
│  Players       8                                       │
│  Sport         Pickleball                              │
│  Source        ai_chat                                 │
└────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `/ai-community` | Static placeholder | Live chat with draft panel | `'use client'` page, uses `useAIChat` |
| Draft panel | Not shown | Updates with every AI response | Chat API now returns `draftFields` + `completionPct` |
| Approval card | Not shown | Appears when `requires_approval: true` | Replaces draft panel in right column |
| Approve button | Not wired | Calls `approveEvent()` → redirect | Uses `useRouter` from `next/navigation` |
| `/events/[id]` | Static placeholder | Real event data from DB | Server Component, `EventService.getEvent` |
| README | Next.js boilerplate | Project setup + demo guide | Covers env, Supabase, dev, demo walkthrough |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `hooks/useAIChat.ts` | all | Hook to update with draftFields + completionPct |
| P0 (critical) | `app/api/chat/route.ts` | 177-253 | API response to extend; approval bug to fix |
| P0 (critical) | `components/ai-chat/AIChatShell.tsx` | all | Add `chatFooter` prop |
| P1 (important) | `components/event-draft/LiveDraftPanel.tsx` | all | DraftField interface to satisfy |
| P1 (important) | `components/event-draft/ApprovalCard.tsx` | all | Props needed for approval card |
| P1 (important) | `components/ai-chat/MessageBubble.tsx` | all | Props for message rendering |
| P1 (important) | `components/ai-chat/SmartChips.tsx` | all | Props for chip strip |
| P1 (important) | `components/ai-chat/ChatComposer.tsx` | all | Props for composer |
| P2 (reference) | `features/events/event.service.ts` | all | `getEvent` method used in detail page |
| P2 (reference) | `features/events/event.types.ts` | all | `EventDraft` + helper functions |
| P2 (reference) | `components/shared/StatusBadge.tsx` | all | Used in event detail page |
| P2 (reference) | `components/event-draft/EntityPreviewCard.tsx` | all | Used in event detail page |

## External Documentation

No external research needed — feature uses established internal patterns.

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: app/ai-community/page.tsx (current, to replace)
// 'use client' pages: default export as UpperCamelCase function named for the route
export default function AICommunityPage() { ... }

// SOURCE: app/events/[id]/page.tsx (current, to replace)
// Async server pages: receives params as Promise<{ param: string }>
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  ...
}
```

### COMPONENT_PROPS_PATTERN
```typescript
// SOURCE: components/ai-chat/AIChatShell.tsx:4-8
export interface AIChatShellProps {
  chatContent: React.ReactNode
  draftContent: React.ReactNode
  className?: string
}
// Pattern: optional props use ?, required use no modifier
```

### ERROR_HANDLING
```typescript
// SOURCE: hooks/useAIChat.ts:106-108
} catch (e) {
  setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
  setMessages(prev => prev.filter(m => m.id !== optimisticId))
}
// Pattern: guard with instanceof Error before .message
```

### SERVER_COMPONENT_DATA_FETCH
```typescript
// SOURCE: app/events/[id]/page.tsx (current stub pattern)
// All data fetching happens directly in the async Server Component body
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // call services directly — no useEffect, no client fetch
  const eventService = new EventService()
  const result = await eventService.getEvent(id)
  ...
}
```

### JSON_CAST_PATTERN
```typescript
// SOURCE: app/api/chat/route.ts:189, app/api/events/route.ts:91
// Always cast via as unknown as TargetType for Supabase Json column assignments
action_payload_json: { draft: mergedDraft } as unknown as Json,
```

### TEST_STRUCTURE
```typescript
// SOURCE: app/api/chat/__tests__/chat.test.ts:1-5
import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
// bun:test, describe/test/expect pattern; inline schema re-declarations for routes
```

### TAILWIND_CLASSES
```typescript
// SOURCE: components/event-draft/LiveDraftPanel.tsx, globals.css
// Brand tokens: text-primary, text-muted, bg-soft, bg-cream, bg-warm
// bg-soft = teal chat background, bg-cream = draft panel / event detail bg
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `app/api/chat/route.ts` | UPDATE | Fix approval payload bug; add `draftFields` + `completionPct` to response |
| `hooks/useAIChat.ts` | UPDATE | Handle `draftFields`/`completionPct` in response; populate `draft.fields`/`draft.completionPct` |
| `components/ai-chat/AIChatShell.tsx` | UPDATE | Add optional `chatFooter` prop for composer below scroll area |
| `app/ai-community/page.tsx` | REPLACE | Full implementation: hook, messages, chips, composer, draft panel, approval card, redirect |
| `app/events/[id]/page.tsx` | REPLACE | Server Component: fetch event from DB, render with EntityPreviewCard + StatusBadge |
| `README.md` | REPLACE | Project-specific: env setup, Supabase, dev server, demo walkthrough, architecture |

## NOT Building

- Streaming chat (Phase 5 uses non-streaming `runOrchestrator` — stays as-is)
- Real-time WebSocket draft updates (polling via chat turn is sufficient for POC)
- Event participants section on detail page (no participants seeded; `event_participants` table exists but no data)
- Reject flow (sends "Let's start over" message to restart conversation; no DB state rollback)
- Mobile responsive layout (web-first per PRD)
- Authentication (seeded DEMO_USER_ID throughout)

---

## Step-by-Step Tasks

### Task 1: Fix approval payload bug + extend chat API response

- **ACTION**: Update `app/api/chat/route.ts` in two places: (a) step 12 — use merged draft in approval payload, (b) final `NextResponse.json` — add `draftFields` and `completionPct`
- **IMPLEMENT**:

  ```typescript
  // After step 11 (draft upsert), compute merged draft for use in step 12 and response:
  const mergedDraftFields: Record<string, unknown> = aiResponse.draft_update
    ? { ...(currentDraft ?? {}), ...aiResponse.draft_update }
    : currentDraft ?? {}
  const draftCompletionPct = draftId
    ? getEventDraftCompletionPercentage(mergedDraftFields as EventDraft)
    : 0

  // Step 12: Fix approval payload to use mergedDraftFields (not stale currentDraft)
  action_payload_json: { draft: mergedDraftFields } as unknown as Json,

  // Final response — add two fields:
  return NextResponse.json({
    conversationId,
    draftId,
    approvalId,
    draftFields: mergedDraftFields,   // ← NEW
    completionPct: draftCompletionPct, // ← NEW
    aiResponse: { ... }               // unchanged
  })
  ```

- **MIRROR**: JSON_CAST_PATTERN (for `as unknown as Json`)
- **IMPORTS**: No new imports needed — `getEventDraftCompletionPercentage` and `EventDraft` already imported at top of file
- **GOTCHA**: The existing code at step 12 uses `currentDraft` (loaded BEFORE the orchestrator ran). The orchestrator's `draft_update` contains the NEW fields from this turn. The approval payload must include the merged draft so `EventService.createEvent` sees the full picture when the user approves. This is the bug that would cause events to be created with stale/incomplete data.
- **VALIDATE**: `bun run type-check` — zero errors

### Task 2: Update useAIChat to consume draftFields + completionPct

- **ACTION**: Update `ChatApiResponse` interface and `sendMessage` in `hooks/useAIChat.ts`
- **IMPLEMENT**:

  ```typescript
  interface ChatApiResponse {
    conversationId: string
    draftId: string | null
    approvalId: string | null
    draftFields: Record<string, unknown> | null  // ← NEW
    completionPct: number                        // ← NEW
    aiResponse: {
      assistant_message: string
      intent: string
      quick_replies: string[]
      requires_approval: boolean
      approval_action: string | null
      missing_fields: string[]
    }
  }

  // In sendMessage, after setting conversationId and draftId:
  if (data.draftId) {
    setDraft(prev => ({
      ...prev,
      id: data.draftId,
      fields: data.draftFields ?? prev.fields,         // ← UPDATE
      completionPct: data.completionPct ?? prev.completionPct, // ← UPDATE
      missingFields: data.aiResponse.missing_fields,
    }))
  }
  ```

- **MIRROR**: Existing `sendMessage` pattern in hooks/useAIChat.ts:84-91
- **IMPORTS**: No new imports needed
- **GOTCHA**: `data.draftFields` is `null` when no draft update occurred (first turn). Use `?? prev.fields` to preserve the previous state.
- **VALIDATE**: `bun run type-check` — zero errors

### Task 3: Extend AIChatShell with chatFooter prop

- **ACTION**: Add optional `chatFooter?: React.ReactNode` to `AIChatShellProps` and render it below the scrollable area
- **IMPLEMENT**:

  ```typescript
  export interface AIChatShellProps {
    chatContent: React.ReactNode
    chatFooter?: React.ReactNode   // ← NEW: composer + chips
    draftContent: React.ReactNode
    className?: string
  }

  export function AIChatShell({ chatContent, chatFooter, draftContent, className }: AIChatShellProps) {
    return (
      <div className={cn('flex h-screen overflow-hidden', className)}>
        <div className="flex flex-1 flex-col bg-soft">
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
            {chatContent}
          </div>
          {chatFooter && (
            <div className="shrink-0 border-t border-border bg-soft px-4 py-3 space-y-2">
              {chatFooter}
            </div>
          )}
        </div>
        <div className="w-px bg-border shrink-0" aria-hidden="true" />
        <div className="w-[400px] shrink-0 overflow-y-auto bg-cream">
          {draftContent}
        </div>
      </div>
    )
  }
  ```

- **MIRROR**: COMPONENT_PROPS_PATTERN — optional prop with `?`, same interface structure
- **IMPORTS**: No change — `React` already in scope via JSX transform
- **GOTCHA**: The `chatFooter` div uses `shrink-0` to prevent it from being squeezed when messages fill the scroll area. Without it the composer will disappear off-screen.
- **VALIDATE**: `bun run type-check` — zero errors

### Task 4: Implement /ai-community page

- **ACTION**: Replace the placeholder `app/ai-community/page.tsx` with the fully wired chat UI
- **IMPLEMENT**:

  ```typescript
  'use client'
  import { useState, useRef, useEffect, useCallback } from 'react'
  import { useRouter } from 'next/navigation'
  import { useAIChat } from '@/hooks/useAIChat'
  import { AIChatShell } from '@/components/ai-chat/AIChatShell'
  import { MessageBubble } from '@/components/ai-chat/MessageBubble'
  import { SmartChips } from '@/components/ai-chat/SmartChips'
  import { ChatComposer } from '@/components/ai-chat/ChatComposer'
  import { LiveDraftPanel } from '@/components/event-draft/LiveDraftPanel'
  import { ApprovalCard } from '@/components/event-draft/ApprovalCard'
  import type { DraftField } from '@/components/event-draft/LiveDraftPanel'

  const DRAFT_FIELDS: Array<{ key: string; label: string; isRequired: boolean }> = [
    { key: 'title',          label: 'Title',       isRequired: true  },
    { key: 'event_type',     label: 'Event Type',  isRequired: true  },
    { key: 'start_at',       label: 'Date & Time', isRequired: true  },
    { key: 'player_capacity',label: 'Players',     isRequired: true  },
    { key: 'court_name',     label: 'Court',       isRequired: false },
    { key: 'description',    label: 'Description', isRequired: false },
  ]

  export default function AICommunityPage() {
    const router = useRouter()
    const { messages, draft, isLoading, error, sendMessage, approveEvent } = useAIChat()
    const [input, setInput] = useState('')
    const [isApproving, setIsApproving] = useState(false)
    const [approveError, setApproveError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = useCallback(() => {
      if (!input.trim() || isLoading) return
      sendMessage(input)
      setInput('')
    }, [input, isLoading, sendMessage])

    const handleChipSelect = useCallback((chip: string) => {
      sendMessage(chip)
    }, [sendMessage])

    // Last assistant message that requires approval (most recent wins)
    const approvalMessage = [...messages].reverse().find(
      m => m.role === 'assistant' && m.requiresApproval && m.approvalId
    ) ?? null

    const handleApprove = useCallback(async () => {
      if (!approvalMessage?.approvalId) return
      setIsApproving(true)
      setApproveError(null)
      try {
        const eventId = await approveEvent(approvalMessage.approvalId)
        router.push(`/events/${eventId}`)
      } catch (e) {
        setApproveError(e instanceof Error ? e.message : 'Failed to create event')
        setIsApproving(false)
      }
    }, [approvalMessage, approveEvent, router])

    const handleReject = useCallback(() => {
      sendMessage("Let's start over with a different event.")
    }, [sendMessage])

    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
    const chips = lastAssistantMsg?.quickReplies ?? []

    const draftFields: DraftField[] = DRAFT_FIELDS.map(({ key, label, isRequired }) => ({
      label,
      value: draft.fields[key] as string | number | null | undefined,
      isRequired,
    }))

    const chatContent = (
      <>
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted py-8">
            Start by describing the event you want to create.
          </p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <MessageBubble role="assistant" content="" isLoading />}
        {error && (
          <p className="text-center text-xs text-red-500 py-1">{error}</p>
        )}
        <div ref={messagesEndRef} />
      </>
    )

    const chatFooter = (
      <>
        {chips.length > 0 && (
          <SmartChips chips={chips} onSelect={handleChipSelect} disabled={isLoading} />
        )}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          placeholder="Describe your event, e.g. '8-player doubles this Saturday morning'"
        />
      </>
    )

    const draftContent = approvalMessage ? (
      <div className="p-5">
        <ApprovalCard
          title={(draft.fields.title as string | undefined) ?? 'Untitled Event'}
          eventType={(draft.fields.event_type as string | undefined) ?? 'open_play'}
          startAt={(draft.fields.start_at as string | undefined) ?? '—'}
          courtName={(draft.fields.court_name as string | null | undefined) ?? null}
          playerCapacity={(draft.fields.player_capacity as number | undefined) ?? 0}
          description={(draft.fields.description as string | null | undefined) ?? null}
          missingFields={approvalMessage.missingFields ?? []}
          onApprove={handleApprove}
          onReject={handleReject}
          isApproving={isApproving}
        />
        {approveError && (
          <p className="mt-2 text-xs text-red-500">{approveError}</p>
        )}
      </div>
    ) : (
      <LiveDraftPanel
        fields={draftFields}
        completionPct={draft.completionPct}
        missingFields={draft.missingFields}
      />
    )

    return <AIChatShell chatContent={chatContent} chatFooter={chatFooter} draftContent={draftContent} />
  }
  ```

- **MIRROR**: SERVER_COMPONENT_DATA_FETCH (inverse — this is a client page), TAILWIND_CLASSES for brand tokens, ERROR_HANDLING pattern for approveError
- **IMPORTS**: Listed in IMPLEMENT block above — all from `@/components/...`, `@/hooks/useAIChat`, `next/navigation`
- **GOTCHA 1**: `'use client'` MUST be the first line — the page uses `useState`, `useEffect`, `useCallback`, `useRef`, and `useRouter`. Without it, Next.js will try to render as a Server Component and crash.
- **GOTCHA 2**: `messagesEndRef` attached to an empty `<div>` at the END of the message list enables smooth scroll-to-bottom. The `scrollIntoView` call is in a `useEffect` watching `messages`.
- **GOTCHA 3**: `[...messages].reverse().find(...)` finds the LAST matching message without mutating state. Do NOT use `messages.reverse()` — that mutates the state array in place.
- **GOTCHA 4**: Type casting for `draft.fields[key]` — `draft.fields` is `Record<string, unknown>`. Cast each field explicitly (`as string | undefined`, `as number | undefined`) to satisfy `DraftField`'s `value: string | number | null | undefined` type.
- **VALIDATE**: `bun run type-check` — zero errors; `bun run build` — page renders

### Task 5: Implement /events/[id] page

- **ACTION**: Replace placeholder `app/events/[id]/page.tsx` with a Server Component that fetches the event from Supabase and renders it
- **IMPLEMENT**:

  ```typescript
  import Link from 'next/link'
  import { notFound } from 'next/navigation'
  import { EventService } from '@/features/events/event.service'
  import { EntityPreviewCard } from '@/components/event-draft/EntityPreviewCard'
  import { StatusBadge } from '@/components/shared/StatusBadge'
  import type { StatusBadgeVariant } from '@/components/shared/StatusBadge'

  export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const eventService = new EventService()
    const result = await eventService.getEvent(id)

    if (result.error || !result.data) {
      notFound()
    }

    const event = result.data

    const fields = [
      { label: 'Title',        value: event.title },
      { label: 'Type',         value: event.event_type?.replace(/_/g, ' ') ?? '—' },
      { label: 'Sport',        value: event.sport_type },
      { label: 'Date',         value: event.start_at },
      { label: 'Players',      value: event.player_capacity },
      { label: 'Court ID',     value: event.court_id ?? event.location_name ?? '—' },
      { label: 'Description',  value: event.description ?? '—' },
      { label: 'Source',       value: event.source },
      { label: 'Created',      value: event.created_at },
    ]

    return (
      <main className="min-h-screen bg-cream px-4 py-10">
        <div className="mx-auto max-w-lg space-y-6">
          <Link
            href="/ai-community"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to chat
          </Link>

          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-ink">{event.title}</h1>
            <StatusBadge status={event.status as StatusBadgeVariant} />
          </div>

          <EntityPreviewCard title="Event Details" fields={fields} />
        </div>
      </main>
    )
  }
  ```

- **MIRROR**: SERVER_COMPONENT_DATA_FETCH (async server component), NAMING_CONVENTION (EventDetailPage), TAILWIND_CLASSES
- **IMPORTS**: `next/navigation` for `notFound`, `@/features/events/event.service` for EventService, components from their paths
- **GOTCHA 1**: `notFound()` from `next/navigation` renders the nearest `not-found.tsx` boundary. Do NOT use `NextResponse` — this is a Server Component, not a route handler.
- **GOTCHA 2**: `event.status` type from DB is `'draft' | 'published' | 'cancelled' | 'completed'` — cast to `StatusBadgeVariant` which accepts those exact values. If the types drift, prefer the explicit cast over `as StatusBadgeVariant`.
- **GOTCHA 3**: `EventService` internally uses `createServiceClient()` which uses `SUPABASE_SERVICE_ROLE_KEY`. This is safe in a Server Component. NEVER call this in a client component.
- **VALIDATE**: `bun run type-check` — zero errors

### Task 6: Rewrite README

- **ACTION**: Replace `README.md` with a project-specific setup guide
- **IMPLEMENT**: Full README covering:
  - Project overview and demo hypothesis
  - Prerequisites (Node, Bun, Supabase CLI, OpenAI API key)
  - Environment variables (`.env.local` template with explanation of each)
  - Setup steps (clone → install → supabase start → seed → dev)
  - Demo walkthrough (7-step guide from opening chat to event detail page)
  - Architecture overview (6 layers: foundation, AI core, services, UI, API routes, pages)
  - Future modules section (tournament, player profile, skill assessment)
- **MIRROR**: Project-specific content from the PRD
- **GOTCHA**: The README must list `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** variable and warn that it must NEVER be given a `NEXT_PUBLIC_` prefix. This is a permanent constraint documented in the codebase.
- **VALIDATE**: Markdown renders correctly

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| AIChatShell renders with chatFooter | `chatFooter=<div>composer</div>` | chatFooter visible | No |
| AIChatShell renders without chatFooter | `chatFooter` omitted | No footer div | Yes — undefined prop |

These are minimal render shape tests using bun:test (same pattern as `hooks/__tests__/useAIChat.test.ts`). No jsdom — just export shape verification.

### Edge Cases Checklist

- [ ] No messages yet — placeholder text visible
- [ ] `approvalMessage` with no `approvalId` — ApprovalCard does not render
- [ ] `approveEvent` throws — `approveError` shown, button re-enabled (`isApproving=false`)
- [ ] Event ID not found — `notFound()` triggers 404
- [ ] `draft.fields` is empty on first turn — LiveDraftPanel shows `—` for all fields (valid per spec)
- [ ] `requires_approval: true` on first turn (unlikely but possible) — ApprovalCard shown with empty draft

---

## Validation Commands

### Static Analysis
```bash
bun run type-check
```
EXPECT: Zero type errors

### Unit Tests
```bash
bun test components/ai-chat hooks app/ai-community app/events
```
EXPECT: All existing tests pass, new shape test passes

### Full Test Suite
```bash
bun test
```
EXPECT: No regressions (74+ pass, 0 fail)

### Build Check
```bash
bun run build
```
EXPECT: Build succeeds; all routes listed; no type errors in build output

### Browser Validation
```bash
bun dev
```
Manual walkthrough:
- [ ] `http://localhost:3000` redirects to `/ai-community`
- [ ] Chat composer visible, placeholder text correct
- [ ] Draft panel shows "0% complete" initially
- [ ] Sending a message shows optimistic user bubble + loading indicator
- [ ] AI response appears, chips populate
- [ ] Draft panel updates with each AI turn
- [ ] When AI says "ready to create", ApprovalCard appears
- [ ] Clicking Approve → redirects to `/events/{id}`
- [ ] Event detail page shows correct event title + Published badge
- [ ] "Back to chat" link works

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] `bun run type-check` — zero errors
- [ ] `bun test` — all 74+ tests pass, no regressions
- [ ] `bun run build` — succeeds
- [ ] Manual demo: user creates event in ≤5 messages, approves, lands on event detail
- [ ] `events` Supabase table has one new record after approval
- [ ] `audit_logs` Supabase table has one entry for `event.created`

## Completion Checklist

- [ ] `'use client'` on AICommunity page
- [ ] No `createServiceClient()` calls in client components
- [ ] `approvalMessage.approvalId` null-checked before calling `approveEvent`
- [ ] `[...messages].reverse()` used (not mutating `messages.reverse()`)
- [ ] `chatFooter` is `shrink-0` so it doesn't scroll away
- [ ] `notFound()` used (not a custom 404 component)
- [ ] `README.md` warns that `SUPABASE_SERVICE_ROLE_KEY` must NOT have `NEXT_PUBLIC_` prefix
- [ ] No hardcoded values (brand colors from Tailwind tokens)
- [ ] No unnecessary abstraction added beyond what's needed

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI approval payload bug causes empty events | Medium | High | Task 1 fixes this before Task 4 wires the UI |
| `draft.fields` stays empty if API change in Task 1 type-checks wrong | Low | Medium | Type-check after Task 1 before proceeding to Task 4 |
| Server Component (`EventDetail`) can't import EventService if it uses Next.js-only features | Low | Low | EventService only uses Supabase client; confirmed safe in server context |
| `notFound()` in Server Component requires `not-found.tsx` to avoid unhandled error | Low | Low | Next.js shows default 404 if no `not-found.tsx`; acceptable for POC |

## Notes

- **Execution order matters**: Task 1 (API fix) → Task 2 (hook update) → Task 3 (AIChatShell) → Task 4 (AI Community page) → Task 5 (Event Detail) → Task 6 (README). Each task enables the next.
- **Approval payload bug**: The existing `app/api/chat/route.ts` (step 12) uses `currentDraft` (snapshot BEFORE orchestrator ran) for the approval payload. This means events could be created with stale data. Task 1 fixes this by using `mergedDraftFields = { ...currentDraft, ...aiResponse.draft_update }`.
- **No streaming**: Phase 5 implemented non-streaming `generateObject`. The UI uses polling-style chat turns (send → wait → receive). This is intentional for POC.
- **Brand tokens**: All colors are Tailwind custom properties defined in `globals.css` — use `text-primary`, `bg-soft`, `bg-cream`, `text-muted`, `text-ink` directly.
