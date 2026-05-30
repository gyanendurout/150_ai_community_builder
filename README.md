# AI Community Assistant — Pickleball POC

A proof-of-concept AI-powered event creation assistant for pickleball communities. Users describe an event in natural language, watch the draft panel populate in real time, then approve the event with one click.

## Demo Hypothesis

> *"A pickleball organiser can create a well-structured community event in under 5 chat turns using natural language alone."*

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Bun | latest | `npm i -g bun` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |
| OpenAI API key | — | [platform.openai.com](https://platform.openai.com) |

---

## Environment Setup

Copy the example file and fill in all values:

```bash
cp .env.local.example .env.local
```

### Required Variables

```env
# Supabase — public values (safe to expose to browser)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Supabase service role — SERVER ONLY
# WARNING: NEVER prefix with NEXT_PUBLIC_ — this key bypasses Row Level Security
# and would expose your entire database if sent to the browser.
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# OpenAI
OPENAI_API_KEY=sk-...

# POC demo user — must match the seeded user ID in supabase/seed.sql
DEMO_USER_ID=00000000-0000-0000-0000-000000000001

# App base URL (used for absolute links in emails, etc.)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Start local Supabase (Docker must be running)
supabase start

# 3. Apply schema and seed data
supabase db reset

# 4. Start the development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/ai-community`.

---

## Demo Walkthrough

Follow these steps to exercise the complete end-to-end flow:

1. **Open the chat** at `/ai-community`. The left column shows the chat interface; the right column shows the live event draft (0% complete).

2. **Describe the event.** Type something like:
   > "Create an 8-player doubles pickleball event this Saturday morning"

3. **Watch the draft panel update.** As the AI extracts fields (title, event type, player count), the draft panel fills in and the completion percentage rises.

4. **Answer follow-up questions.** The AI will ask for any missing required fields (e.g., exact date/time). Use the quick-reply chips or type your own response.

5. **Approve the event.** When all required fields are collected, an approval card replaces the draft panel. Review the details and click **Approve & Create**.

6. **Event detail page.** You land on `/events/{id}` showing the newly created event with a **Published** status badge and all the field data you provided.

7. **Return to chat.** Click **← Back to chat** to start a new conversation.

---

## Architecture

```
app/                        Next.js App Router pages and API routes
├── ai-community/page.tsx   Client page — chat UI wired to useAIChat hook
├── events/[id]/page.tsx    Server page — fetches event from DB, renders details
├── api/chat/route.ts       POST /api/chat — runs AI orchestrator, persists messages/drafts/approvals
└── api/events/route.ts     POST /api/events — creates event from approved draft

components/
├── ai-chat/                Chat shell, message bubbles, smart chips, composer
└── event-draft/            Live draft panel, approval card, entity preview card

features/
├── ai/                     Orchestrator + prompt builder (uses OpenAI via Vercel AI SDK)
├── drafts/                 Draft CRUD service + repository
├── approvals/              Approval CRUD service
├── events/                 Event service, repository, types, schema
└── memory/                 User memory service (preferences, past events)

hooks/
└── useAIChat.ts            Client hook — manages messages, draft state, sendMessage, approveEvent

lib/
├── supabase/               Server and browser Supabase clients + generated types
├── errors.ts               Result<T> discriminated union
├── logger.ts               Structured logger
└── constants.ts            DEMO_USER_ID, sport/event type enums
```

### Key Design Decisions

- **Server-only Supabase service client**: `SUPABASE_SERVICE_ROLE_KEY` is used only in Server Components (`/events/[id]`) and API routes (`/api/chat`, `/api/events`). It is never sent to the browser.
- **Optimistic UI**: `useAIChat` adds the user message to state immediately, before the API responds, for zero-latency feedback.
- **Non-streaming**: The AI orchestrator uses `generateObject` (structured JSON output) rather than streaming text — optimised for field extraction accuracy over perceived speed.
- **Demo user**: All operations are attributed to `DEMO_USER_ID` (seeded in `supabase/seed.sql`). No auth layer in this POC.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run type-check` | TypeScript — zero errors required |
| `bun test` | Run all tests |
| `bun test:ai` | Run AI feature tests only |

---

## Future Modules

The PRD defines four additional AI assistant modules beyond event creation:

| Module | Status | Description |
|--------|--------|-------------|
| Tournament creation | Planned | Multi-phase bracket + schedule assistant |
| Player profile | Planned | Skill level, availability, preferences |
| Skill assessment | Planned | Post-match rating and improvement suggestions |
| Community discovery | Planned | Find events and players near me |
