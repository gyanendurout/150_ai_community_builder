# AI Community Assistant Platform — Event Creation POC

*Generated: 2026-05-29*
*Status: DRAFT — approved by product owner before generation*
*Sport: Pickleball (Joola community)*
*Auth: Seeded demo user (no real auth for POC)*
*AI Model: OpenAI GPT-4o via Vercel AI SDK*
*Deploy: Vercel*

---

## Problem Statement

Pickleball community organizers waste significant time and cognitive effort creating events through rigid form-based interfaces — specifying venue, time, player count, skill level, and invites across disconnected steps. The experience does not adapt to the organizer's patterns (preferred courts, regular players, typical event size), forcing them to re-enter the same information repeatedly. No existing tool combines natural-language event creation with AI memory, structured validation, and a human-approval gate before any data is committed.

## Evidence

- Community organizers create recurring weekly events with nearly identical parameters — yet every platform restarts from a blank form each time.
- Assumption: organizers abandon event creation mid-flow when the form is too long (needs validation through user research post-POC).
- Assumption: WhatsApp/group-chat coordination is the dominant fallback, indicating no tool has solved the "quick, low-friction event creation" problem (needs validation).
- Joola operates a pickleball community platform — this feature closes the creation UX gap.

## Proposed Solution

A web app where the user types a natural-language request ("Create an 8-player doubles event this Saturday morning near me") and an AI assistant handles the rest: detecting intent, reading the user's memory for preferences, asking only the next necessary question, updating a live draft panel, and presenting a structured approval card before committing any data. The architecture is designed as a multi-module AI Community Platform — event creation is module one; tournament creation, profiles, and skill assessment follow the same pattern without rewriting the app.

## Key Hypothesis

We believe that a conversational AI event creation flow with memory-based suggestions and an explicit approval gate will reduce time-to-event-created by >60% compared to form-based creation for Joola pickleball community organizers. We'll know we're right when a demo user can create a complete pickleball event through chat in under 5 exchanges.

## What We're NOT Building

- Mobile app — web-first, responsive later
- Real court booking / payment — courts are seeded static data for POC
- Tournament creation UI — folder structure scaffolded, implementation deferred
- Player profile AI — same: scaffolded, deferred
- Real invite sending — mocked for POC, abstraction ready
- Calendar integration — deferred to Phase 2
- Real weather API — stub returns mock data; WeatherService abstraction is real
- Multi-user auth — single seeded demo user for POC

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Exchanges to complete event | ≤ 5 messages | Manual demo walkthrough |
| Draft completion via chat | 100% of required fields filled | Code + demo |
| Zero direct DB writes without approval | All event saves go through approval gate | Code review |
| All 14 tables created with RLS | Schema migration runs clean | `supabase db push` output |
| Cold-start dev setup | ≤ 15 min with README | Peer test |

## Open Questions

- [ ] Should memory seed use realistic Joola court names or generic placeholders?
- [ ] Does GPT-4o structured output handle missing-field detection reliably, or do we need explicit validation fallback?
- [ ] What is the right max conversation length before we summarize/compact context?
- [ ] Post-POC: will real users prefer chip-based quick replies or free-text for most turns?

---

## Users & Context

**Primary User**
- **Who**: Joola pickleball community organizer — a regular player who runs weekly or bi-weekly events for a consistent group of 6–16 players.
- **Current behavior**: Creates events via WhatsApp messages + manual venue booking, or through a form-based app that doesn't remember their preferences.
- **Trigger**: "I want to set up our usual Saturday morning doubles game" — a recurring, low-effort intent that today requires high-effort execution.
- **Success state**: Event is created, visible, and shareable in under 2 minutes with zero form-filling.

**Job to Be Done**
When I want to organize a pickleball session for my regular group, I want to describe what I want in plain language, so I can have an event ready to share without re-entering the same details I always use.

**Non-Users**
- Casual one-time players (no recurring pattern = no memory value)
- Tournament directors (different complexity — deferred to Phase 4)
- Court venue administrators (B2B, out of scope)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | AI chat → event draft via structured output | Core value proposition |
| Must | Live draft panel (updates in real time as chat progresses) | Shows AI "working" — builds trust |
| Must | Approval gate before any DB write | AI safety, audit, user control |
| Must | User memory seed (preferred court, time, player count) | Demonstrates personalization value |
| Must | Event detail page post-creation | Proof the event exists + shareable |
| Must | 14-table Supabase schema + migrations | Production-ready foundation |
| Must | Modular service architecture | Enables Phase 2–5 without rewrite |
| Should | Quick reply chips (smart suggestions inside chat) | Reduces typing friction |
| Should | Court suggestion cards (AIOptionCard) | Better than typing court name |
| Should | Missing fields summary before approval | Prevents incomplete events |
| Should | Audit log entry on event creation | Production governance from day one |
| Could | Weather stub shown in draft panel | Visual proof of weather service hook |
| Could | Feature flags table seeded | Ready for Phase 2 feature gating |
| Won't | Real invite sending | Mocked — abstraction is real |
| Won't | Calendar .ics export | Deferred to Phase 2 |
| Won't | Real auth (Supabase Auth) | Seeded demo user for POC |
| Won't | Tournament / profile AI modules | Folder structure only |

### MVP Scope

A single demo user opens `/ai-community`, types a pickleball event request, has a ≤5-turn conversation with the AI, approves the draft, and lands on `/events/[id]` with a fully saved event. The AI reads from seeded memory, suggests courts from seeded data, mocks weather, and routes every save through the approval service. All 14 tables exist with RLS enabled.

### User Flow (Critical Path)

```
1. User opens /ai-community
2. Types: "Set up an 8-player doubles game this Saturday at 9am"
3. AI detects intent: event_creation
   → Reads user_memory (preferred court: Joola Court A, usual players: 8)
   → Returns: assistant_message + draft_update + quick_replies
4. Draft panel updates: event_type=doubles, player_count=8, preferred_time=Sat 9am
5. AI: "I see you usually play at Joola Court A — use that again?"
   → SmartChips: ["Yes, Court A", "Different court", "Check options"]
6. User clicks "Yes, Court A"
   → draft_update: court_id=<seed>
7. AI: "Title? I can suggest: 'Saturday Doubles — May 31'"
   → User: "Looks good"
   → draft_update: title=..., status=complete
8. AI: "Ready to create. Here's your event:" → ApprovalCard shown
9. User clicks "Approve & Create Event"
   → ApprovalService validates → EventService saves → AuditLog entry
10. Redirect to /events/[id]
```

---

## Technical Approach

**Feasibility**: HIGH — all chosen technologies are mature and specifically designed for this use case.

### Architecture

```
src/
  app/
    ai-community/
      page.tsx                    ← Main AI chat shell
    events/
      [id]/
        page.tsx                  ← Event detail

  components/
    ai-chat/
      AIChatShell.tsx
      MessageBubble.tsx
      SmartChips.tsx
      ChatComposer.tsx
    event-draft/
      LiveDraftPanel.tsx
      ApprovalCard.tsx
      EntityPreviewCard.tsx
    shared/
      AIOptionCard.tsx
      MemorySuggestionCard.tsx
      StatusBadge.tsx
      ToolResultCard.tsx

  features/
    ai/
      ai-orchestrator.ts          ← Intent detection, conversation routing
      model-provider.ts           ← OpenAI abstraction (swap-ready)
      prompt-builder.ts           ← System prompt + context injection
      tool-registry.ts            ← All registered AI tools
      structured-output-schema.ts ← Zod schemas for AI response shape
    events/
      event.service.ts
      event.repository.ts
      event.schema.ts             ← Zod validation
      event.types.ts
    memory/
      memory.service.ts
      memory.repository.ts
    drafts/
      draft.service.ts
      draft.repository.ts
    approvals/
      approval.service.ts
      approval.repository.ts
    courts/
      court.service.ts            ← Static seed for POC
      court.repository.ts
    weather/
      weather.service.ts          ← Stub returning mock data
    notifications/
      notification.service.ts     ← Stub for POC
    profiles/
      profile.service.ts          ← Placeholder, not implemented
    tournaments/
      tournament.service.ts       ← Placeholder, not implemented
    audit/
      audit.service.ts

  lib/
    supabase/
      client.ts                   ← Browser client
      server.ts                   ← Server client
    config/
      feature-flags.ts
    logger/
      index.ts

  app/api/
    chat/
      route.ts                    ← Vercel AI SDK streaming handler
```

### AI Response Shape (Zod + Structured Output)

```typescript
// Every AI response is typed — never plain text only
const AIResponseSchema = z.object({
  assistant_message: z.string(),
  intent: z.enum(['event_creation', 'tournament_creation', 'profile_creation', 'general', 'clarification']),
  draft_update: z.record(z.unknown()).optional(),
  quick_replies: z.array(z.string()).max(4).optional(),
  tool_calls: z.array(z.string()).optional(),
  requires_approval: z.boolean(),
  approval_action: z.enum(['create_event', 'send_invites', 'publish_tournament', 'save_profile']).nullable(),
  missing_fields: z.array(z.string()).optional(),
})
```

### Registered AI Tools (Phase 1)

```
get_user_memory          → reads user_memory table for preferences
update_event_draft       → updates draft in DB + returns new draft state
suggest_event_time       → returns 3 time options based on memory
suggest_courts           → returns seeded court list with distances (mocked)
check_weather            → returns mock weather stub
generate_event_title     → returns 3 title suggestions
generate_invite_message  → returns draft invite text (not sent)
prepare_create_event_approval → assembles approval payload, sets requires_approval=true
```

### Database Schema (14 tables)

All tables use UUID primary keys, `created_at`/`updated_at` timestamps, and RLS enabled.

```sql
-- 1. users (seeded demo user for POC)
-- 2. user_profiles (skill_level, dupr_rating, play_style)
-- 3. user_memory (memory_type, memory_key, memory_value_json, confidence_score)
-- 4. conversations (conversation_type, status, current_entity_type, current_entity_id)
-- 5. conversation_messages (role: user|assistant|system|tool, message_type, metadata_json)
-- 6. ai_runs (model_provider, model_name, input_tokens, output_tokens, status)
-- 7. ai_tool_calls (tool_name, input_json, output_json, status, requires_approval, approved_by_user)
-- 8. drafts (entity_type, entity_id, draft_json, status, completion_percentage, missing_fields_json)
-- 9. approvals (action_type, action_payload_json, status, approved_at, rejected_at)
-- 10. events (organizer_id, event_type, sport_type, start_at, court_id, player_capacity, status, source)
-- 11. event_participants (event_id, user_id, status: invited|accepted|declined|waitlisted)
-- 12. courts (name, address, lat/lng, indoor_outdoor, source)
-- 13. audit_logs (actor_user_id, action, entity_type, entity_id, before_json, after_json)
-- 14. feature_flags (flag_key, enabled, description, rollout_percentage)
```

### Feature Flags (seeded)

```
feature_ai_event_creation        = true
feature_ai_profile_creation      = false
feature_ai_tournament_creation   = false
feature_weather                  = true   (stub)
feature_court_search             = false  (static seed)
feature_calendar                 = false
feature_invites                  = false  (stub)
```

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GPT-4o structured output misses required fields | M | Zod parse + fallback re-prompt |
| Supabase RLS blocks demo user | L | Seed user with known UUID, test policies in migration |
| Vercel AI SDK streaming + structured output conflict | M | Use `streamObject` not `streamText` for structured responses |
| Draft state desync between chat and panel | M | Single source of truth: draft in DB, panel polls/subscribes |
| Context window exhaustion on long conversations | L | Sliding window + summarization hook (stub for POC) |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Foundation | Next.js scaffold, Supabase schema (14 tables), migrations, seed data, Vercel deploy | complete | - | - | `.claude/PRPs/plans/completed/phase-1-foundation.plan.md` |
| 2 | AI Core | model-provider, ai-orchestrator, prompt-builder, tool-registry, structured-output-schema | complete | - | 1 | `.claude/PRPs/plans/completed/phase-2-ai-core.plan.md` |
| 3 | Feature Services | event/memory/draft/approval/court/weather/audit services + repositories | complete | with 4 | 1 | `.claude/PRPs/plans/completed/phase-3-feature-services.plan.md` |
| 4 | UI Components | AIChatShell, MessageBubble, SmartChips, LiveDraftPanel, ApprovalCard, all shared components | complete | with 3 | 1 | `.claude/PRPs/plans/completed/phase-4-ui-components.plan.md` |
| 5 | Chat API + Integration | /api/chat route, connect AI orchestrator → services, streaming, tool execution | complete | - | 2, 3, 4 | `.claude/PRPs/plans/completed/phase-5-chat-api-integration.plan.md` |
| 6 | E2E Flow + Detail Page | /ai-community page, /events/[id] page, end-to-end demo walkthrough, README | complete | - | 5 | `.claude/PRPs/plans/completed/phase-6-e2e-flow-detail-page.plan.md` |

### Phase Details

**Phase 1: Foundation**
- **Goal**: Working Next.js app connected to Supabase, all 14 tables created with RLS, seed data loaded, deployed to Vercel.
- **Scope**: `npx create-next-app`, Tailwind + shadcn setup, Supabase project init, 14 SQL migrations, seed SQL (1 demo user + profile + memory records + 5 courts + feature flags), `.env.local` template, Vercel project linked.
- **Success signal**: `supabase db push` runs clean, `vercel dev` starts without errors, seed data visible in Supabase dashboard.

**Phase 2: AI Core**
- **Goal**: OpenAI GPT-4o integration with structured output, tool calling, and a provider abstraction layer.
- **Scope**: `model-provider.ts` (wraps `openai` SDK, `generateObject` via Vercel AI SDK), `structured-output-schema.ts` (Zod AIResponseSchema), `tool-registry.ts` (8 tool definitions), `prompt-builder.ts` (system prompt with memory context injection), `ai-orchestrator.ts` (routes user message → tools → response).
- **Success signal**: Unit test passes — mock user message "create doubles event Saturday" returns valid `AIResponseSchema` object with `intent=event_creation` and at least one `draft_update`.

**Phase 3: Feature Services** *(parallel with Phase 4)*
- **Goal**: Clean, typed service + repository layer for all 8 feature domains.
- **Scope**: `EventService` (create, get, list), `MemoryService` (get by user + key), `DraftService` (create, update, get completion %), `ApprovalService` (create, approve, reject), `CourtService` (list seeded courts), `WeatherService` (stub), `AuditService` (log action). All use Supabase server client. All throw typed errors, never swallow.
- **Success signal**: Each service has a smoke test hitting the real Supabase dev DB.

**Phase 4: UI Components** *(parallel with Phase 3)*
- **Goal**: Complete reusable component library for the AI chat + draft experience.
- **Scope**: `AIChatShell` (layout: left=chat, right=draft panel), `MessageBubble` (user/assistant/tool variants), `SmartChips` (quick reply row), `AIOptionCard` (court/time suggestion card), `MemorySuggestionCard` (memory-based pre-fill card), `LiveDraftPanel` (field-by-field event draft), `ApprovalCard` (full event preview + approve/reject buttons), `ChatComposer` (text input + send), `EntityPreviewCard`, `StatusBadge`. All components accept props only — no internal data fetching.
- **Success signal**: Storybook-style render test (or just manual visual check) — all components render without errors with mock props.

**Phase 5: Chat API + Integration**
- **Goal**: Working end-to-end streaming chat that connects the AI orchestrator to all services.
- **Scope**: `app/api/chat/route.ts` (Vercel AI SDK `streamObject`, reads conversation from DB, calls orchestrator, persists message + ai_run + tool_calls, returns stream). `useChat` hook on frontend consumes stream and updates `LiveDraftPanel` in real time.
- **Success signal**: Postman/curl to `/api/chat` with a test message returns a valid streaming AI response and creates records in `conversation_messages`, `ai_runs`, `ai_tool_calls`, and `drafts` tables.

**Phase 6: E2E Flow + Detail Page**
- **Goal**: Full demo-ready user journey from chat open to event detail page.
- **Scope**: `/ai-community/page.tsx` (renders `AIChatShell`, initialises conversation), `/events/[id]/page.tsx` (fetches event + participants, renders event card), approval button wires to `POST /api/events` (calls `ApprovalService.approve` → `EventService.create` → `AuditService.log`), redirect to event detail. README with setup steps + future modules doc.
- **Success signal**: Full demo walkthrough passes — user creates event in ≤5 messages, approves, lands on event detail page with correct data, Supabase `events` table has one record, `audit_logs` has one entry.

### Parallelism Notes

Phases 3 (services) and 4 (UI components) are fully independent — services have no UI dependency and components use mock props only. Run them in parallel. All other phases are sequential: Foundation → AI Core → (Services ‖ Components) → Chat API → E2E.

---

## Decisions Log

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| ORM | Supabase client (typed) + raw SQL for migrations | Drizzle ORM, Prisma | POC speed; add Drizzle in Phase 2 if query complexity grows |
| AI response shape | `streamObject` (Vercel AI SDK) + Zod | `streamText` + manual JSON parsing | Type safety from day one; prevents hallucinated field names |
| State management | DB as single source of truth for draft | React state, Zustand | Survives page refresh; auditable; backend-driven |
| Auth | Seeded demo user | Supabase Auth Google OAuth | POC speed; real auth is a Phase 2 swap-in |
| Styling | Tailwind + shadcn/ui | MUI, Chakra, custom | Matches brand token system; fastest iteration |
| Sport domain | Pickleball-first, schema sport-agnostic | Generic from day one | Delivers concrete value now; `sport_type` column keeps future flexibility |
| Tool calling | Registered tool-registry.ts | Inline tool definitions in route | Enables tool audit, per-tool approval flags, and future tool expansion without touching AI route |
| AI safety | Approval gate before all DB writes | Trust AI output directly | Non-negotiable for production-readiness; builds user trust |

---

## Brand & Design Tokens

```css
--color-primary:    #01625B;  /* deep teal */
--color-secondary:  #027D74;  /* mid teal */
--color-soft:       #E8F4F2;  /* light teal bg */
--color-cream:      #F7F2E8;
--color-warm:       #FFF8ED;
--color-ink:        #1F2933;
--color-muted:      #697586;
```

Chat shell: soft teal background. Draft panel: cream/warm. AI bubbles: white card on soft teal. User bubbles: primary teal. Approval card: white with primary border + CTA button.

---

## Research Summary

**Market Context**
- No mainstream event platform uses conversational AI creation with live draft panel + approval gate.
- Vercel AI SDK `streamObject` is purpose-built for this pattern (structured output from chat streams).
- OpenAI GPT-4o structured outputs enforce JSON schema compliance — eliminates hallucinated field names.
- Supabase is the fastest path to Postgres + RLS + Auth + Storage; production checklist explicitly requires RLS on all public tables.
- Next.js App Router Server Actions enable server-side mutations from the frontend, useful for approval and save operations without a separate API layer.

**Technical Context**
- Feasibility: HIGH
- No existing codebase — greenfield project in `c:\Workspace\150_Health\Community_POC`
- All chosen libraries are at stable, production-ready versions (Next.js 15, Supabase 2.x, Vercel AI SDK 4.x)
- The 14-table schema is normalized and RLS-ready; no columns need to be added to support Phase 2–5 features (only new tables/rows)

---

## Future Modules (Architecture Already Supports)

| Module | conversation_type | entity_type | New Services Needed |
|--------|-------------------|-------------|---------------------|
| AI Tournament Creation | tournament_creation | tournament | tournament.service.ts |
| AI Player Profile | profile_creation | profile | profile.service.ts |
| AI Skill Assessment | skill_assessment | assessment | assessment.service.ts |
| AI Invite Assistant | invite_assist | invite | notification.service.ts |
| Event Chat Assistant | event_chat | event | (reuses existing) |
| Court Recommendation | recommendation | court | recommendation.service.ts |
| Weather/Reschedule | reschedule | event | weather.service.ts (real API) |
| Notification Generator | notification | notification | notification.service.ts |

All future modules plug into the same `AIChatShell`, `conversations` table, `drafts` table, `approvals` table, and `tool-registry.ts`. Zero architectural debt.

---

*PRD Status: APPROVED FOR PLANNING*
*Next step: Run `/prp-plan .claude/PRPs/prds/ai-community-assistant-platform.prd.md` to generate phase implementation plans*
