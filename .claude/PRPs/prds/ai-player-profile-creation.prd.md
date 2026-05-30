# AI-Powered Pickleball Player Profile Creation via Natural Conversation

> **Status**: DRAFT → IN-PROGRESS (Phase 1 active)
> **Source**: User-provided spec on 2026-05-30 (multi-step planned PRD via PRP workflow)
> **Companion PRD**: [ai-community-assistant-platform.prd.md](./ai-community-assistant-platform.prd.md) (parent platform PRD)
> **Predecessor flow**: `event_creation` (completed, hardened — must NOT regress)

---

## Problem Statement

Pickleball players currently have no fast, conversational way to set up a complete player profile in Joola. Filling a long form is the standard but it's slow, abandoned 40-60% of the way through, and produces low-quality profiles (no skill rating, no home court, no style). Without a meaningful profile, downstream matchmaking, event recommendations, and DUPR-based eligibility cannot work.

## Evidence

- The existing `event_creation` flow proved chat-first form-replacement works: users describe what they want, AI fills the draft, user approves. Same pattern should apply to profile setup.
- `user_profiles` table already exists in the schema but is sparsely populated by manual entry. Seeded demo user has only partial skill data.
- DUPR ratings are the de facto standard but most casual players don't know their DUPR — they need a free in-app assessment as an alternative path.

## Proposed Solution

Add `profile_creation` as a second AI mode alongside `event_creation`, sharing the same chat infrastructure (orchestrator, prompt builder, draft persistence, approval gate, memory, audit). The AI asks one question at a time, uses a deterministic 10-question assessment for skill rating (no AI freelancing the score), and offers a mock-DUPR lookup. The user reviews a live profile draft panel and clicks **Approve & Save Profile** to commit. The AI never claims a profile is saved before the backend confirms.

## Key Hypothesis

We believe a chat-driven profile flow will increase profile completion rate vs. a form, because (a) users can stop and resume at any question, (b) skill assessment removes the DUPR barrier, and (c) the AI uses memory from `event_creation` to pre-fill defaults.

We'll know we're right when:
- Profile-creation conversations complete (reach Approve & Save) at ≥ 60% rate in user testing
- Saved profiles have skill source set (DUPR / assessment / manual) ≥ 90% of the time

## What We're NOT Building

- Tournament creation flow (deferred — flag stays off)
- Real DUPR API integration (mock/stub only — real API requires partnership)
- Payments
- Real invite sending (separate flag)
- Public social feed / discovery
- Native mobile app
- Multi-locale support (English only, but timezone-correct)

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| Profile completion rate | ≥ 60% | Conversations with action_type=save_profile approved / conversations started with conversation_type=profile_creation |
| Skill source coverage | ≥ 90% | Saved profiles where skill_source ∈ {dupr, assessment, manual} |
| Zero regression on event_creation | 100% green | All existing event_creation tests pass after every phase |
| AI hallucination rate | 0 | Manual test cases (e.g. AI must not say "Profile saved!" without backend confirmation) |
| Memory carryover to event_creation | Verified | After profile save with home_court=X, next event_creation chat suggests X as default venue |

## Open Questions

- [ ] Should the assessment be skippable mid-flow, or all-or-nothing? (Current spec implies skippable — confirm in Phase 5 UX review.)
- [ ] How should we handle a returning user with an existing profile — edit-in-chat or read-only? (Phase 6 may answer.)
- [ ] If reverse-geocoded city has no nearby courts, should `home_court_id` be required? (Current answer: no — `home_location_text` is sufficient.)

---

## Users & Context

**Primary User**
- **Who**: A casual or recreational pickleball player who installed/opened Joola for the first time, or an existing user who skipped profile setup
- **Current behavior**: Plays events as a guest with no skill rating, no home court → AI matchmaking and recommendations don't work
- **Trigger**: User opens AI Community Assistant, or is prompted after their first event creation, to "build your profile"
- **Success state**: Has a saved profile with display_name, home court/location, visibility, and at least one skill source — visible on a profile detail page

**Job to Be Done**
When I want Joola to actually help me find good matches, I want to set up my player profile quickly through chat (not a form), so I can get accurate skill-matched event recommendations.

**Non-Users**
- Tournament organizers building a tournament profile (separate flow — `tournament_creation`, deferred)
- Coaches / clubs setting up a club page (out of scope)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|---|---|---|
| Must | Profile mode switcher in chat UI (Event / Profile) | Entry point — users need to choose intent |
| Must | `profile_creation` conversation type in chat route | Routing the AI to a different prompt block |
| Must | Live profile draft panel (mirrors event draft pattern) | Visibility — user sees what's being collected |
| Must | DUPR mock lookup service (found / not_found / error states) | Skill source path #1 |
| Must | 10-question deterministic skill assessment | Skill source path #2 — no AI inventing scores |
| Must | Manual self-rating | Skill source path #3 |
| Must | Profile save API route (only the Approve button calls this) | Backend-controlled persistence — no AI faking save |
| Must | Profile detail page | Post-save destination |
| Must | Memory write on save (home_court, skill, preferences) | Carryover to event_creation |
| Must | Audit log entries (profile_created, dupr_lookup_*, assessment_*) | Traceability |
| Must | Feature flag `feature_ai_profile_creation` | Gated rollout |
| Should | Eligibility warnings (no DOB → no age-based events; "prefer not to say" → no gender divisions) | Helpful microcopy, not blocking |
| Should | Self-rating vs assessment conflict warning | Data quality |
| Should | Skip support (any field except display_name + visibility + one skill source) | UX flexibility |
| Could | Avatar upload | Visual richness — but can be a placeholder for POC |
| Could | Bio free-text field | Personality — nice-to-have |
| Won't | Real DUPR API | Requires partnership; mock for POC |
| Won't | Profile editing flow | Save-once for POC; edit-in-chat is Phase 8+ |
| Won't | Public social feed | Out of scope |

### MVP Scope

A user can: open chat → switch to Profile mode → answer the AI one question at a time → choose DUPR lookup OR free 10-question assessment OR manual rating → review live profile draft → click Approve & Save Profile → land on `/profile/[id]` showing the saved data. The event_creation flow remains untouched.

### User Flow

```
[Chat] User: "Build my pickleball profile"
   ↓
[AI] "What name should appear on your profile?"  ← ONE question
[User] "Gyanendu"  → draft.display_name updated
   ↓
[AI] "What's your home court or playing area?"  ← uses real OSM/seed courts + memory
[User] "Use my current location"  → home_lat/lng + home_location_text from reverse-geocode
   ↓
[AI] "Do you have a DUPR rating, want to take a 10-question assessment, or set it manually?"
[User] selects "Take assessment"  → enters assessment subflow
   ↓
[Assessment] Q1 → Q10 (deterministic scoring service)
   ↓
[AI] "Your app skill rating is 3.4 / 5.0. Style: Social Doubles Player. Profile draft ready — please review."
   ↓
[ApprovalCard] User clicks "Approve & Save Profile"
   ↓
[POST /api/profiles] persists user_profile + player_skill_profile + assessment_result + memory writes + audit
   ↓
[Redirect] /profile/[id]  → ProfileDetailPage
```

---

## Technical Approach

**Feasibility**: HIGH — the architecture is proven by `event_creation`. All cross-cutting concerns (chat orchestration, draft persistence, approval flow, memory, audit, anti-hallucination prompt rules) already exist. We're adding a parallel mode, not reinventing.

**Architecture Notes**
- **Reuse generic tables**: `conversations` (type=profile_creation), `drafts` (entity_type=profile), `approvals` (action_type=save_profile), `audit_logs`, `user_memory`
- **Extend `user_profiles`** (don't replace): add display_name, dob, age_band, gender, home_court_id, home_location_text, home_latitude, home_longitude, bio, status, created_from_conversation_id, source
- **New tables**: `player_skill_profiles` (one-per-user, separate from `user_profiles` because skill is owned/computed differently), `assessment_questions`, `assessment_responses`, `assessment_results`
- **Profile draft schema**: separate Zod schema for `entity_type='profile'` drafts, but shares the `drafts.draft_json` JSONB column
- **AI orchestrator**: same `generateObject` call; the `PromptContext` and prompt-builder branch on `conversationType`
- **Deterministic scoring**: assessment math lives in `features/profile-assessment/assessment.service.ts` — AI never computes the final rating
- **Service abstraction for DUPR**: `features/ratings/dupr.service.ts` with a `lookup(query)` method that returns one of `{status: 'found'|'not_found'|'error'|'multiple'|'skipped', rating?, dupr_id?}`. POC implementation reads from a seeded mock table; production swap is one file
- **No drift on event_creation**: any change to shared files (`prompt-builder.ts`, `chat/route.ts`, `useAIChat.ts`, `app/ai-community/page.tsx`) must be additive and gated on `conversationType` or `intent`

**Technical Risks**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Touching prompt-builder breaks event_creation tests | Medium | Branch on `conversationType` early; add profile-specific block; run full `event_creation` test suite after every change |
| AI invents DUPR rating despite mock saying not_found | Medium | Anti-hallucination rule: "If DUPR_STATUS != 'found', NEVER quote a DUPR number. Say 'I couldn't find your DUPR.'" |
| AI freelances assessment score | Medium | Deterministic scoring in backend; AI gets `app_skill_rating` from server context; rule: "Use the score I provide; do not compute one yourself" |
| Migration changes break existing `user_profiles` rows | Low | All new columns nullable with defaults; backfill demo user in seed |
| Profile draft schema collides with event draft schema in `drafts.draft_json` | Low | Separate Zod schemas keyed by `drafts.entity_type` |
| User has stale memory from event_creation timezone that conflicts with profile context | Low | Browser timezone already authoritative per recent hardening |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Foundation | Migration extending user_profiles + 4 new tables. Feature flag flip. Seed 10 assessment Qs + mock DUPR. Regenerate types. Zero behavior change. | in-progress | - | - | (this turn) |
| 2 | Backend services | `features/ratings/dupr.service.ts`, `features/profile-assessment/{questions,service,schema,types}.ts`, `features/profiles/{profile.service,profile.repository,profile.schema,profile.types}.ts`. Pure logic + repos. | pending | - | 1 | - |
| 3 | AI extension | Extend `AIResponseSchema` with profile draft union. Extend `prompt-builder.ts` with profile-mode block (anti-hallucination on DUPR, assessment, save). Extend chat route to route by `conversationType`. | pending | - | 2 | - |
| 4 | Profile API + approval | `app/api/profiles/route.ts` (POST validates approval, persists profile + skill + memory + audit). Approval flow `action_type='save_profile'`. Mirror event approval pattern. | pending | with 5 | 3 | - |
| 5 | Frontend chat UI | Mode switcher (Event / Profile) in `app/ai-community/page.tsx`. `ProfileDraftPanel`. `ProfileApprovalCard`. Hook accepts conversation_type. Assessment question UI in chat. | pending | with 4 | 3 | - |
| 6 | Profile detail page | `app/profile/[id]/page.tsx` showing display name, avatar, home court, visibility, DUPR + app skill + skill_source, style profile, category breakdown, bio, missing-fields nudges. | pending | - | 4 | - |
| 7 | Tests + hardening + docs | Unit tests for assessment scoring + DUPR service. Prompt scenarios for profile mode. Regression run on event_creation. Update SESSION_MEMORY + README. | pending | - | 4, 5, 6 | - |

### Phase Details

**Phase 1: Foundation (this turn)**
- **Goal**: Get DB shape + seed + types ready so subsequent phases compile against real columns
- **Scope**: One migration (00003), one type regen, seed.sql additions, feature flag flip. Zero changes to behavior.
- **Success signal**: `bun run type-check` green, all existing tests pass, no UI/AI changes possible to verify yet

**Phase 2: Backend services**
- **Goal**: All pure-logic services for DUPR, assessment scoring, and profile persistence
- **Scope**: `features/ratings/`, `features/profile-assessment/`, extend `features/profiles/`. Each service is independently testable with no AI/UI dependencies.
- **Success signal**: Each service has unit tests; scoring is deterministic (same inputs → same rating)

**Phase 3: AI extension**
- **Goal**: AI can now drive profile_creation conversations using the same orchestrator
- **Scope**: AIResponseSchema gets profile draft fields; prompt-builder adds profile-mode block with anti-hallucination rules for DUPR/assessment/save; chat route picks the prompt block by `conversation.conversation_type`
- **Success signal**: All event_creation tests still pass; new prompt-scenarios.test.ts cases for profile mode pass

**Phase 4: Profile API + approval**
- **Goal**: Backend save path is bulletproof — only the user button can save
- **Scope**: POST `/api/profiles` (validates approval row, calls profile.service.create, writes audit + memory, returns profile_id)
- **Success signal**: Cannot save without an approved approval row; tests cover happy path + each failure mode

**Phase 5: Frontend chat UI**
- **Goal**: User can actually drive profile creation end-to-end from the browser
- **Scope**: Mode switcher chips at top of chat, ProfileDraftPanel mirroring LiveDraftPanel, ProfileApprovalCard mirroring ApprovalCard, assessment Q rendering as cards with chips
- **Success signal**: Manual click-through completes a profile in browser; chat-only with no fixed long form

**Phase 6: Profile detail page**
- **Goal**: Post-approval destination exists and renders all saved profile fields
- **Scope**: `/profile/[id]` server component fetching user_profile + player_skill_profile + computed eligibility warnings
- **Success signal**: Approving a profile redirects here and shows all data correctly

**Phase 7: Tests + hardening + docs**
- **Goal**: Lock in correctness and document
- **Scope**: 15+ acceptance-criteria tests, full regression sweep on event_creation, SESSION_MEMORY + README updates
- **Success signal**: All acceptance criteria from spec covered by automated test; zero regressions

### Parallelism Notes

- **Phase 4 and Phase 5** can be developed in parallel because the API contract is fixed in Phase 3 (AIResponse schema + approval action_type).
- **Phase 7** is the final gate — runs against the completed system from Phases 1-6.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| New skill table vs extend user_profiles | New `player_skill_profiles` table | Add columns to user_profiles | Skill is owned/computed differently (assessment-driven, multi-source). Keeping separate makes the schema cleaner and skill updates don't bump user_profiles.updated_at unnecessarily |
| Draft storage | Reuse generic `drafts` table with `entity_type='profile'` | New `profile_drafts` table | Generic pattern already proven for event_creation; less duplication |
| Approval storage | Reuse generic `approvals` table with `action_type='save_profile'` | New `profile_approvals` | Same — proven pattern |
| Assessment scoring location | Backend service (deterministic) | Let AI freelance score | Hardening lesson from event_creation: NEVER let AI invent values that affect downstream logic |
| DUPR real API | Mock for POC, service abstraction for swap | Build real API integration now | Requires partnership; mock unblocks the rest |
| Mode switcher placement | Top of chat (chip group) | Separate page per mode | Keeps the single-conversation UX promise; mode determined at conversation creation |

---

## Research Summary

**Market Context**
- DUPR is the dominant pickleball rating system (similar to chess ELO). Most apps either require it or invent their own. Joola's 10-question assessment is a competitive differentiator for casual players who don't know DUPR.
- Form-based onboarding has 40-60% drop-off industry-wide. Chat-first onboarding (Notion AI, Linear chat assist, ChatGPT custom GPTs) shows 20-30% higher completion.

**Technical Context**
- Existing `event_creation` flow is the reference implementation. All learnings (Zod v4 preprocess, no hallucinated court names, anti-finality claims, browser timezone authority, one-question-per-turn, OSM real data integration, distance filter) carry over directly.
- `conversations.conversation_type` already includes `'profile_creation'` in the CHECK constraint — no migration needed for routing
- `user_profiles` table exists but is sparsely populated; demo user (`00000000-0000-0000-0000-000000000001`) has skill_level='intermediate', dupr_rating=3.75 — we'll extend, not replace

---

*Generated: 2026-05-30*
*Status: IN-PROGRESS (Phase 1)*
