# Plan: Phase 1 — Foundation

## Summary
Scaffold a production-ready Next.js 15 + Supabase project with all 14 database tables (migrations + RLS), brand tokens, typed Supabase client, feature-flag helper, logger, and all feature-module folder stubs. Deployed to Vercel. This is the bedrock every subsequent phase builds on — it must be done exactly right.

## User Story
As a developer starting Phase 2,
I want a running Next.js app connected to a seeded Supabase database with all 14 tables and typed clients,
So that I can immediately write AI and service layer code without any setup work.

## Problem → Solution
Empty directory → Working Next.js 15 app on Vercel, Supabase with 14 tables, RLS enabled, seed data loaded, all feature module folders created, type-safe DB client, feature flags, logger, brand tokens in Tailwind.

## Metadata
- **Complexity**: XL
- **Source PRD**: `.claude/PRPs/prds/ai-community-assistant-platform.prd.md`
- **PRD Phase**: Phase 1 — Foundation
- **Estimated Files**: 36

---

## UX Design

### Before
```
┌────────────────────────────────┐
│  Empty directory               │
│  No app, no DB, no types       │
└────────────────────────────────┘
```

### After
```
┌────────────────────────────────────────────┐
│  GET /            → redirects to           │
│  GET /ai-community → placeholder page      │
│                                            │
│  Supabase: 14 tables, RLS, seeded          │
│  Brand: teal tokens in Tailwind            │
│  Types: fully typed DB client              │
│  Flags: feature_flags table seeded         │
└────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `/` | 404 | Redirects to `/ai-community` | `redirect()` in page.tsx |
| `/ai-community` | 404 | Placeholder page with brand colours | Scaffold for Phase 4/6 |
| Supabase | No project | 14 tables, RLS, seed data | Via CLI migrations |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `supabase/migrations/00001_initial_schema.sql` | all | Must understand all 14 tables before writing services |
| P0 | `lib/supabase/types.ts` | all | Every service depends on these types |
| P0 | `lib/supabase/server.ts` | all | Server-side pattern used by ALL feature services |
| P1 | `lib/config/feature-flags.ts` | all | Used by AI orchestrator + every feature route |
| P1 | `lib/constants.ts` | all | DEMO_USER_ID used across all services |
| P2 | `features/events/event.types.ts` | all | Domain types referenced by events + drafts services |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Supabase SSR with Next.js | `@supabase/ssr` docs | Use `createServerClient` in Server Components/API routes; use `createBrowserClient` in Client Components. Do NOT use `@supabase/auth-helpers-nextjs` (deprecated). |
| Vercel AI SDK | `ai` package docs | `streamObject` for structured output from chat; `generateObject` for one-shot; both require a Zod schema. |
| Next.js App Router | Next.js 15 docs | Server Components by default; `"use client"` for interactivity; `cookies()` is async in Next.js 15. |
| Supabase RLS for POC | Supabase docs | With no auth, use `SUPABASE_SERVICE_ROLE_KEY` on server to bypass RLS. Never expose service role key to client. |
| shadcn/ui setup | shadcn docs | `npx shadcn@latest init` after Next.js scaffold; choose "New York" style; CSS variables = yes. |

---

## Patterns to Mirror

Since this is greenfield, these are the patterns WE ARE ESTABLISHING. Every future phase must mirror them.

### NAMING_CONVENTION
```typescript
// Files: kebab-case
// lib/supabase/server.ts
// features/events/event.types.ts
// features/events/event.service.ts

// Functions: camelCase
export function createClient() { ... }
export async function isFeatureEnabled(flagKey: string) { ... }

// Types/Interfaces: PascalCase
export type Database = { ... }
export interface EventDraft { ... }

// Constants: UPPER_SNAKE_CASE
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

// Feature module exports: named, never default (except React components)
export { EventService } from './event.service'
```

### ERROR_HANDLING
```typescript
// All service functions use typed error returns, never throw to caller
// SOURCE: established in this phase, enforced from Phase 3+
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Service functions return Result type
type Result<T> = { data: T; error: null } | { data: null; error: AppError }
```

### LOGGING_PATTERN
```typescript
// SOURCE: lib/logger/index.ts
// Structured JSON logs with level, message, context, timestamp
logger.info('Event created', { eventId, userId, conversationId })
logger.error('Draft update failed', { error: err.message, draftId })
// Never: console.log() in feature code
```

### SUPABASE_SERVER_PATTERN
```typescript
// SOURCE: lib/supabase/server.ts
// Every server-side DB call follows this pattern:
import { createServiceClient } from '@/lib/supabase/server'

const supabase = createServiceClient()
const { data, error } = await supabase.from('events').select('*')
if (error) throw new AppError(error.message, 'DB_ERROR')
```

### FEATURE_FLAG_PATTERN
```typescript
// SOURCE: lib/config/feature-flags.ts
// Check before executing AI-gated features
const enabled = await isFeatureEnabled('feature_ai_event_creation')
if (!enabled) return new Response('Feature disabled', { status: 403 })
```

### TYPE_PATTERN
```typescript
// SOURCE: lib/supabase/types.ts
// Use Row type for reads, Insert for creates, Update for patches
type EventRow = Database['public']['Tables']['events']['Row']
type EventInsert = Database['public']['Tables']['events']['Insert']
type EventUpdate = Database['public']['Tables']['events']['Update']
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json` | CREATE | Project dependencies |
| `next.config.ts` | CREATE | Next.js config |
| `tsconfig.json` | CREATE | TypeScript strict mode |
| `tailwind.config.ts` | CREATE | Brand tokens as Tailwind colors |
| `postcss.config.mjs` | CREATE | Required by Tailwind |
| `.env.local.example` | CREATE | Environment variable template |
| `.gitignore` | CREATE | Exclude .env.local, .next, node_modules |
| `app/layout.tsx` | CREATE | Root layout with Inter font |
| `app/page.tsx` | CREATE | Root redirect to /ai-community |
| `app/globals.css` | CREATE | CSS custom properties + Tailwind imports |
| `app/ai-community/page.tsx` | CREATE | Placeholder page (Phase 4/6 fills it) |
| `app/events/[id]/page.tsx` | CREATE | Placeholder page (Phase 6 fills it) |
| `lib/supabase/client.ts` | CREATE | Browser Supabase client |
| `lib/supabase/server.ts` | CREATE | Server Supabase client (service role) |
| `lib/supabase/types.ts` | CREATE | Full typed Database interface (all 14 tables) |
| `lib/config/feature-flags.ts` | CREATE | Feature flag cache + helper |
| `lib/logger/index.ts` | CREATE | Structured JSON logger |
| `lib/constants.ts` | CREATE | DEMO_USER_ID + other shared constants |
| `lib/errors.ts` | CREATE | AppError class + Result type |
| `supabase/config.toml` | CREATE | Supabase CLI config |
| `supabase/migrations/00001_initial_schema.sql` | CREATE | All 14 tables + indexes + triggers + RLS |
| `supabase/seed.sql` | CREATE | Demo user, 5 courts, memory records, feature flags |
| `features/ai/index.ts` | CREATE | Placeholder — Phase 2 fills this |
| `features/events/event.types.ts` | CREATE | Domain types: EventDraft, EventStatus, etc. |
| `features/events/index.ts` | CREATE | Re-export barrel — Phase 3 fills this |
| `features/memory/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `features/drafts/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `features/approvals/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `features/courts/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `features/weather/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `features/notifications/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `features/profiles/index.ts` | CREATE | Placeholder — deferred to Phase 3/later |
| `features/tournaments/index.ts` | CREATE | Placeholder — deferred to later |
| `features/audit/index.ts` | CREATE | Placeholder — Phase 3 fills this |
| `components/ai-chat/.gitkeep` | CREATE | Folder scaffold for Phase 4 |
| `components/event-draft/.gitkeep` | CREATE | Folder scaffold for Phase 4 |
| `components/shared/.gitkeep` | CREATE | Folder scaffold for Phase 4 |

## NOT Building
- Any UI beyond a placeholder page (Phase 4)
- Any service logic (Phase 3)
- Any AI code (Phase 2)
- Real authentication (Phase 2 beta)
- API routes (Phase 5)
- Event detail page content (Phase 6)

---

## Step-by-Step Tasks

### Task 1: Scaffold Next.js Project
- **ACTION**: Create Next.js 15 project with App Router, TypeScript, Tailwind, ESLint
- **IMPLEMENT**:
  ```bash
  npx create-next-app@latest . \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir=false \
    --import-alias="@/*"
  ```
  Then install additional dependencies:
  ```bash
  npm install @supabase/ssr @supabase/supabase-js
  npm install ai @ai-sdk/openai
  npm install zod
  npm install clsx tailwind-merge class-variance-authority lucide-react
  ```
  Then init shadcn:
  ```bash
  npx shadcn@latest init
  # Choose: New York style, CSS variables: yes, base color: neutral
  ```
- **MIRROR**: NAMING_CONVENTION
- **IMPORTS**: n/a (scaffolding step)
- **GOTCHA**: `create-next-app` will fail if the directory has any files. Run from the project root after confirming it's empty. On Windows PowerShell, use `.` as the directory argument to scaffold in-place.
- **VALIDATE**: `npm run dev` starts without errors. `localhost:3000` shows default Next.js page.

### Task 2: Update `tailwind.config.ts` with Brand Tokens
- **ACTION**: Replace generated config with brand-aware version
- **IMPLEMENT**:
  ```typescript
  // tailwind.config.ts
  import type { Config } from 'tailwindcss'

  const config: Config = {
    darkMode: ["class"],
    content: [
      './pages/**/*.{js,ts,jsx,tsx,mdx}',
      './components/**/*.{js,ts,jsx,tsx,mdx}',
      './app/**/*.{js,ts,jsx,tsx,mdx}',
      './features/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
      extend: {
        colors: {
          primary: { DEFAULT: '#01625B', hover: '#027D74' },
          secondary: '#027D74',
          soft: '#E8F4F2',
          cream: '#F7F2E8',
          warm: '#FFF8ED',
          ink: '#1F2933',
          muted: '#697586',
        },
        fontFamily: {
          sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        },
      },
    },
    plugins: [require("tailwindcss-animate")],
  }

  export default config
  ```
  Install animate plugin: `npm install tailwindcss-animate`
- **MIRROR**: NAMING_CONVENTION
- **GOTCHA**: shadcn requires `darkMode: ["class"]` and `tailwindcss-animate`. Add both here.
- **VALIDATE**: `npm run build` with no Tailwind errors.

### Task 3: Update `app/globals.css` with CSS Custom Properties
- **ACTION**: Add brand CSS custom properties used by shadcn and custom components
- **IMPLEMENT**:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  :root {
    --color-primary: #01625B;
    --color-secondary: #027D74;
    --color-soft: #E8F4F2;
    --color-cream: #F7F2E8;
    --color-warm: #FFF8ED;
    --color-ink: #1F2933;
    --color-muted: #697586;

    /* shadcn CSS variable overrides */
    --background: 0 0% 100%;
    --foreground: 215 25% 17%;
    --primary: 174 98% 19%;
    --primary-foreground: 0 0% 100%;
    --muted: 215 14% 54%;
    --muted-foreground: 215 14% 54%;
    --border: 215 14% 89%;
    --radius: 0.625rem;
  }
  ```
- **GOTCHA**: shadcn uses HSL values for CSS variables — the hex values go in tailwind.config.ts; the HSL equivalents go here for shadcn components. Both needed.
- **VALIDATE**: shadcn Button component renders with teal primary colour.

### Task 4: Create Root Layout and Route Scaffold
- **ACTION**: Update `app/layout.tsx`, create `app/page.tsx` redirect, create placeholder pages
- **IMPLEMENT**:

  `app/layout.tsx`:
  ```tsx
  import type { Metadata } from 'next'
  import { Inter } from 'next/font/google'
  import './globals.css'

  const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

  export const metadata: Metadata = {
    title: 'AI Community Assistant | Joola',
    description: 'Create pickleball events through natural conversation',
  }

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body className={`${inter.variable} font-sans bg-cream text-ink antialiased`}>
          {children}
        </body>
      </html>
    )
  }
  ```

  `app/page.tsx`:
  ```tsx
  import { redirect } from 'next/navigation'
  export default function HomePage() {
    redirect('/ai-community')
  }
  ```

  `app/ai-community/page.tsx`:
  ```tsx
  export default function AICommunityPage() {
    return (
      <main className="min-h-screen bg-soft flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-primary">AI Community Assistant</h1>
          <p className="text-muted">Event creation chat — coming in Phase 4</p>
        </div>
      </main>
    )
  }
  ```

  `app/events/[id]/page.tsx`:
  ```tsx
  export default function EventDetailPage({ params }: { params: { id: string } }) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-primary">Event Detail</h1>
          <p className="text-muted">Event ID: {params.id} — coming in Phase 6</p>
        </div>
      </main>
    )
  }
  ```
- **GOTCHA**: `params` in Next.js 15 App Router is a Promise in some contexts. For static placeholder pages, direct destructuring is fine. Phase 6 will handle the async params pattern properly.
- **VALIDATE**: `localhost:3000` redirects to `/ai-community`. Placeholder page renders in teal.

### Task 5: Create `.env.local.example` and `.gitignore`
- **ACTION**: Document all required env vars; ensure secrets are not committed
- **IMPLEMENT**:

  `.env.local.example`:
  ```bash
  # ─── Supabase ──────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

  # ─── OpenAI (used in Phase 2) ──────────────────────────────────────────
  OPENAI_API_KEY=sk-...

  # ─── POC Demo User ─────────────────────────────────────────────────────
  # Matches the seeded user ID in supabase/seed.sql
  DEMO_USER_ID=00000000-0000-0000-0000-000000000001

  # ─── App ───────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

  Add to `.gitignore` (merge with create-next-app's generated .gitignore):
  ```
  # env files
  .env
  .env.local
  .env.*.local

  # Supabase
  .supabase/
  ```
- **GOTCHA**: `SUPABASE_SERVICE_ROLE_KEY` must NEVER be `NEXT_PUBLIC_` prefixed — it would be exposed to the browser. Only use it in Server Components, API routes, and Server Actions.
- **VALIDATE**: `grep -r "SERVICE_ROLE" app/` returns no results — confirm it's never imported client-side.

### Task 6: Create Supabase Client Files
- **ACTION**: Create typed browser and server Supabase clients
- **IMPLEMENT**:

  `lib/supabase/client.ts`:
  ```typescript
  import { createBrowserClient } from '@supabase/ssr'
  import type { Database } from './types'

  export function createClient() {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  ```

  `lib/supabase/server.ts`:
  ```typescript
  import { createClient as createSupabaseClient } from '@supabase/supabase-js'
  import type { Database } from './types'

  /**
   * Service-role client for server-side operations.
   * Bypasses RLS — POC uses this since there is no session auth.
   * Phase 2 will add a session-scoped client alongside this.
   */
  export function createServiceClient() {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  ```
- **MIRROR**: SUPABASE_SERVER_PATTERN
- **GOTCHA**: Do NOT use `createServerClient` from `@supabase/ssr` for the service role client. `@supabase/supabase-js` `createClient` with service role key is correct. `@supabase/ssr`'s `createServerClient` is for user-session auth only.
- **VALIDATE**: Import `createServiceClient` in a test server action and verify it returns without throwing.

### Task 7: Create `lib/supabase/types.ts` — Full Database Type Definitions
- **ACTION**: Manually define the typed Database interface for all 14 tables
- **IMPLEMENT**: This file is large but critical. Every service in Phase 3 depends on these types.

  ```typescript
  // lib/supabase/types.ts
  export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

  export type Database = {
    public: {
      Tables: {
        users: {
          Row: {
            id: string
            name: string
            email: string
            phone: string | null
            avatar_url: string | null
            home_location: Json | null
            home_court_id: string | null
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string
            created_at?: string
            updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['users']['Insert']>
        }
        courts: {
          Row: {
            id: string
            name: string
            address: string | null
            latitude: number | null
            longitude: number | null
            indoor_outdoor: 'indoor' | 'outdoor' | 'both' | null
            source: string
            external_place_id: string | null
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['courts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['courts']['Insert']>
        }
        user_profiles: {
          Row: {
            id: string
            user_id: string
            skill_level: 'beginner' | 'intermediate' | 'advanced' | 'pro' | null
            dupr_rating: number | null
            app_skill_rating: number | null
            play_style: string | null
            visibility: 'public' | 'private' | 'friends'
            profile_completion_percentage: number
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
        }
        user_memory: {
          Row: {
            id: string
            user_id: string
            memory_type: string
            memory_key: string
            memory_value_json: Json
            confidence_score: number
            source: string
            last_used_at: string | null
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['user_memory']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['user_memory']['Insert']>
        }
        conversations: {
          Row: {
            id: string
            user_id: string
            conversation_type: 'event_creation' | 'tournament_creation' | 'profile_creation' | 'event_chat' | 'support' | 'general'
            status: 'active' | 'completed' | 'abandoned'
            current_entity_type: string | null
            current_entity_id: string | null
            title: string | null
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['conversations']['Insert']>
        }
        conversation_messages: {
          Row: {
            id: string
            conversation_id: string
            user_id: string | null
            role: 'user' | 'assistant' | 'system' | 'tool'
            message_text: string
            message_type: 'text' | 'tool_call' | 'tool_result' | 'system'
            metadata_json: Json | null
            created_at: string
          }
          Insert: Omit<Database['public']['Tables']['conversation_messages']['Row'], 'id' | 'created_at'> & {
            id?: string; created_at?: string
          }
          Update: Partial<Database['public']['Tables']['conversation_messages']['Insert']>
        }
        ai_runs: {
          Row: {
            id: string
            conversation_id: string
            user_id: string
            model_provider: string
            model_name: string
            input_tokens: number | null
            output_tokens: number | null
            status: 'pending' | 'running' | 'completed' | 'failed'
            error_message: string | null
            created_at: string
          }
          Insert: Omit<Database['public']['Tables']['ai_runs']['Row'], 'id' | 'created_at'> & {
            id?: string; created_at?: string
          }
          Update: Partial<Database['public']['Tables']['ai_runs']['Insert']>
        }
        ai_tool_calls: {
          Row: {
            id: string
            ai_run_id: string
            tool_name: string
            input_json: Json | null
            output_json: Json | null
            status: 'pending' | 'running' | 'completed' | 'failed'
            requires_approval: boolean
            approved_by_user: boolean | null
            created_at: string
          }
          Insert: Omit<Database['public']['Tables']['ai_tool_calls']['Row'], 'id' | 'created_at'> & {
            id?: string; created_at?: string
          }
          Update: Partial<Database['public']['Tables']['ai_tool_calls']['Insert']>
        }
        drafts: {
          Row: {
            id: string
            user_id: string
            conversation_id: string | null
            entity_type: 'event' | 'tournament' | 'profile' | 'invite_message'
            entity_id: string | null
            draft_json: Json
            status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'committed'
            completion_percentage: number
            missing_fields_json: Json
            ai_summary: string | null
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['drafts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['drafts']['Insert']>
        }
        approvals: {
          Row: {
            id: string
            user_id: string
            conversation_id: string | null
            action_type: 'create_event' | 'send_invites' | 'publish_tournament' | 'save_profile' | 'send_message' | 'process_refund'
            action_payload_json: Json
            status: 'pending' | 'approved' | 'rejected' | 'expired'
            approved_at: string | null
            rejected_at: string | null
            created_at: string
          }
          Insert: Omit<Database['public']['Tables']['approvals']['Row'], 'id' | 'created_at'> & {
            id?: string; created_at?: string
          }
          Update: Partial<Database['public']['Tables']['approvals']['Insert']>
        }
        events: {
          Row: {
            id: string
            organizer_id: string
            title: string
            description: string | null
            event_type: 'singles' | 'doubles' | 'mixed_doubles' | 'open_play' | 'drill' | 'tournament' | null
            sport_type: string
            start_at: string
            end_at: string | null
            timezone: string
            court_id: string | null
            location_name: string | null
            address: string | null
            latitude: number | null
            longitude: number | null
            player_capacity: number
            visibility: 'public' | 'private' | 'invite_only'
            status: 'draft' | 'published' | 'cancelled' | 'completed'
            source: 'ai_chat' | 'manual' | 'import'
            created_from_conversation_id: string | null
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['events']['Insert']>
        }
        event_participants: {
          Row: {
            id: string
            event_id: string
            user_id: string
            status: 'invited' | 'accepted' | 'declined' | 'waitlisted' | 'cancelled' | 'attended'
            invited_by: string | null
            joined_at: string | null
            cancelled_at: string | null
          }
          Insert: Omit<Database['public']['Tables']['event_participants']['Row'], 'id'> & { id?: string }
          Update: Partial<Database['public']['Tables']['event_participants']['Insert']>
        }
        audit_logs: {
          Row: {
            id: string
            actor_user_id: string | null
            action: string
            entity_type: string
            entity_id: string | null
            before_json: Json | null
            after_json: Json | null
            created_at: string
          }
          Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'> & {
            id?: string; created_at?: string
          }
          Update: never
        }
        feature_flags: {
          Row: {
            id: string
            flag_key: string
            enabled: boolean
            description: string | null
            rollout_percentage: number
            created_at: string
            updated_at: string
          }
          Insert: Omit<Database['public']['Tables']['feature_flags']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; created_at?: string; updated_at?: string
          }
          Update: Partial<Database['public']['Tables']['feature_flags']['Insert']>
        }
      }
    }
  }

  // Convenience row type aliases
  export type UserRow = Database['public']['Tables']['users']['Row']
  export type CourtRow = Database['public']['Tables']['courts']['Row']
  export type EventRow = Database['public']['Tables']['events']['Row']
  export type EventInsert = Database['public']['Tables']['events']['Insert']
  export type ConversationRow = Database['public']['Tables']['conversations']['Row']
  export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
  export type MessageRow = Database['public']['Tables']['conversation_messages']['Row']
  export type MessageInsert = Database['public']['Tables']['conversation_messages']['Insert']
  export type DraftRow = Database['public']['Tables']['drafts']['Row']
  export type DraftInsert = Database['public']['Tables']['drafts']['Insert']
  export type ApprovalRow = Database['public']['Tables']['approvals']['Row']
  export type ApprovalInsert = Database['public']['Tables']['approvals']['Insert']
  export type AiRunInsert = Database['public']['Tables']['ai_runs']['Insert']
  export type AiToolCallInsert = Database['public']['Tables']['ai_tool_calls']['Insert']
  export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
  export type FeatureFlagRow = Database['public']['Tables']['feature_flags']['Row']
  export type UserMemoryRow = Database['public']['Tables']['user_memory']['Row']
  ```
- **GOTCHA**: `audit_logs.Update` is `never` — audit records are immutable. Future services must only INSERT, never UPDATE audit_logs.
- **VALIDATE**: `npm run type-check` passes with zero errors after this file is created.

### Task 8: Create Shared Utilities
- **ACTION**: Create logger, error class, constants, feature-flag helper
- **IMPLEMENT**:

  `lib/errors.ts`:
  ```typescript
  export class AppError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number = 500
    ) {
      super(message)
      this.name = 'AppError'
    }
  }

  export type Result<T> =
    | { data: T; error: null }
    | { data: null; error: AppError }

  export function ok<T>(data: T): Result<T> {
    return { data, error: null }
  }

  export function err(message: string, code: string, statusCode = 500): Result<never> {
    return { data: null, error: new AppError(message, code, statusCode) }
  }
  ```

  `lib/constants.ts`:
  ```typescript
  export const DEMO_USER_ID = process.env.DEMO_USER_ID ?? '00000000-0000-0000-0000-000000000001'

  export const SPORT_TYPES = ['pickleball', 'tennis', 'badminton', 'padel'] as const
  export type SportType = typeof SPORT_TYPES[number]

  export const EVENT_TYPES = ['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament'] as const
  export type EventType = typeof EVENT_TYPES[number]

  export const CONVERSATION_TYPES = ['event_creation', 'tournament_creation', 'profile_creation', 'event_chat', 'support', 'general'] as const
  export type ConversationType = typeof CONVERSATION_TYPES[number]
  ```

  `lib/logger/index.ts`:
  ```typescript
  type LogLevel = 'debug' | 'info' | 'warn' | 'error'

  function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry = { level, message, context, timestamp: new Date().toISOString() }
    if (level === 'error') console.error(JSON.stringify(entry))
    else if (level === 'warn') console.warn(JSON.stringify(entry))
    else console.log(JSON.stringify(entry))
  }

  export const logger = {
    debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  }
  ```

  `lib/config/feature-flags.ts`:
  ```typescript
  import { createServiceClient } from '@/lib/supabase/server'
  import { logger } from '@/lib/logger'

  const cache: Record<string, boolean> = {}
  let loadedAt: number | null = null
  const TTL = 60_000

  export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
    const now = Date.now()
    if (!loadedAt || now - loadedAt > TTL) {
      try {
        const supabase = createServiceClient()
        const { data, error } = await supabase
          .from('feature_flags')
          .select('flag_key, enabled')
        if (error) {
          logger.error('Failed to load feature flags', { error: error.message })
          return cache[flagKey] ?? false
        }
        data?.forEach(({ flag_key, enabled }) => { cache[flag_key] = enabled })
        loadedAt = now
      } catch (e) {
        logger.error('Feature flag load exception', { error: String(e) })
      }
    }
    return cache[flagKey] ?? false
  }

  export const FLAGS = {
    AI_EVENT_CREATION: 'feature_ai_event_creation',
    AI_PROFILE_CREATION: 'feature_ai_profile_creation',
    AI_TOURNAMENT_CREATION: 'feature_ai_tournament_creation',
    WEATHER: 'feature_weather',
    COURT_SEARCH: 'feature_court_search',
    CALENDAR: 'feature_calendar',
    INVITES: 'feature_invites',
  } as const
  ```
- **MIRROR**: LOGGING_PATTERN, ERROR_HANDLING
- **GOTCHA**: Feature flag cache is module-level in a serverless environment — it resets on cold start. This is acceptable for POC. Phase 5 can add Redis or Edge Config for prod-grade caching.
- **VALIDATE**: `npm run type-check` passes.

### Task 9: Create Event Domain Types
- **ACTION**: Define all domain-level types for the events feature
- **IMPLEMENT**:

  `features/events/event.types.ts`:
  ```typescript
  import type { EventRow, CourtRow } from '@/lib/supabase/types'

  export type EventStatus = EventRow['status']
  export type EventType = EventRow['event_type']
  export type EventVisibility = EventRow['visibility']
  export type EventSource = EventRow['source']

  export interface EventDraft {
    title?: string
    description?: string
    event_type?: EventType
    sport_type?: string
    start_at?: string
    end_at?: string
    timezone?: string
    court_id?: string
    court_name?: string
    location_name?: string
    player_capacity?: number
    visibility?: EventVisibility
  }

  export interface EventWithCourt extends EventRow {
    court: CourtRow | null
  }

  export type DraftStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'committed'

  export type RequiredEventFields = 'title' | 'start_at' | 'event_type' | 'player_capacity'

  export const REQUIRED_EVENT_FIELDS: RequiredEventFields[] = [
    'title', 'start_at', 'event_type', 'player_capacity'
  ]

  export function getEventDraftCompletionPercentage(draft: EventDraft): number {
    const total = REQUIRED_EVENT_FIELDS.length + 2 // +court, +description
    const filled = [
      draft.title,
      draft.start_at,
      draft.event_type,
      draft.player_capacity,
      draft.court_id ?? draft.location_name,
      draft.description,
    ].filter(Boolean).length
    return Math.round((filled / total) * 100)
  }

  export function getMissingEventFields(draft: EventDraft): string[] {
    const missing: string[] = []
    if (!draft.title) missing.push('title')
    if (!draft.start_at) missing.push('start_at')
    if (!draft.event_type) missing.push('event_type')
    if (!draft.player_capacity) missing.push('player_capacity')
    if (!draft.court_id && !draft.location_name) missing.push('court')
    return missing
  }
  ```
- **MIRROR**: NAMING_CONVENTION, TYPE_PATTERN
- **VALIDATE**: `npm run type-check` passes. The utility functions are pure and testable — but no unit tests in Phase 1 (Phase 3 adds tests alongside services).

### Task 10: Create Feature Module Placeholders
- **ACTION**: Create `index.ts` stub for all feature modules
- **IMPLEMENT**: Each file is a single comment (not empty — empty files cause lint warnings in some configs):

  `features/ai/index.ts`:
  ```typescript
  // AI feature module — implemented in Phase 2
  // Exports: aiOrchestrator, modelProvider, promptBuilder, toolRegistry, structuredOutputSchema
  ```

  `features/events/index.ts`:
  ```typescript
  export * from './event.types'
  // EventService, EventRepository — implemented in Phase 3
  ```

  `features/memory/index.ts`, `features/drafts/index.ts`, `features/approvals/index.ts`, `features/courts/index.ts`, `features/weather/index.ts`, `features/notifications/index.ts`, `features/audit/index.ts`:
  ```typescript
  // [Feature name] module — implemented in Phase 3
  ```

  `features/profiles/index.ts`:
  ```typescript
  // Player profile AI module — deferred to Phase 3 (beta) / later
  ```

  `features/tournaments/index.ts`:
  ```typescript
  // Tournament creation AI module — deferred to Phase 4
  ```
- **GOTCHA**: Do not add actual exports from `features/events/index.ts` that don't exist yet — importing a barrel that re-exports nothing is fine, but importing a named export that doesn't exist will break the build.
- **VALIDATE**: `npm run build` succeeds.

### Task 11: Create Supabase Config and Migration
- **ACTION**: Initialize Supabase CLI config and write the initial schema migration
- **IMPLEMENT**:

  First, install Supabase CLI (if not installed):
  ```bash
  # Windows PowerShell:
  npm install -g supabase
  # Verify:
  supabase --version
  ```

  Initialize Supabase config in project:
  ```bash
  supabase init
  ```
  This creates `supabase/config.toml`.

  Create the migration file at `supabase/migrations/00001_initial_schema.sql`:
  ```sql
  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- ─── 1. COURTS (before users — users.home_court_id references courts) ──────────
  CREATE TABLE courts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    indoor_outdoor TEXT CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
    source TEXT NOT NULL DEFAULT 'manual',
    external_place_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 2. USERS ────────────────────────────────────────────────────────────────
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    home_location JSONB,
    home_court_id UUID REFERENCES courts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 3. USER_PROFILES ────────────────────────────────────────────────────────
  CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'pro')),
    dupr_rating DECIMAL(4,2),
    app_skill_rating DECIMAL(4,2),
    play_style TEXT,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'friends')),
    profile_completion_percentage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 4. USER_MEMORY ──────────────────────────────────────────────────────────
  CREATE TABLE user_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value_json JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL DEFAULT 'manual',
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, memory_key)
  );

  -- ─── 5. CONVERSATIONS ────────────────────────────────────────────────────────
  CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_type TEXT NOT NULL CHECK (
      conversation_type IN ('event_creation','tournament_creation','profile_creation','event_chat','support','general')
    ),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    current_entity_type TEXT,
    current_entity_id UUID,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 6. CONVERSATION_MESSAGES ────────────────────────────────────────────────
  CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    message_text TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (
      message_type IN ('text', 'tool_call', 'tool_result', 'system')
    ),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 7. AI_RUNS ──────────────────────────────────────────────────────────────
  CREATE TABLE ai_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    model_provider TEXT NOT NULL DEFAULT 'openai',
    model_name TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 8. AI_TOOL_CALLS ────────────────────────────────────────────────────────
  CREATE TABLE ai_tool_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    input_json JSONB,
    output_json JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by_user BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 9. DRAFTS ───────────────────────────────────────────────────────────────
  CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('event','tournament','profile','invite_message')),
    entity_id UUID,
    draft_json JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (
      status IN ('draft','pending_approval','approved','rejected','committed')
    ),
    completion_percentage INTEGER NOT NULL DEFAULT 0,
    missing_fields_json JSONB NOT NULL DEFAULT '[]',
    ai_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 10. APPROVALS ───────────────────────────────────────────────────────────
  CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    action_type TEXT NOT NULL CHECK (
      action_type IN ('create_event','send_invites','publish_tournament','save_profile','send_message','process_refund')
    ),
    action_payload_json JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 11. EVENTS ──────────────────────────────────────────────────────────────
  CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('singles','doubles','mixed_doubles','open_play','drill','tournament')),
    sport_type TEXT NOT NULL DEFAULT 'pickleball',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    court_id UUID REFERENCES courts(id),
    location_name TEXT,
    address TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    player_capacity INTEGER NOT NULL DEFAULT 8,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','invite_only')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','completed')),
    source TEXT NOT NULL DEFAULT 'ai_chat' CHECK (source IN ('ai_chat','manual','import')),
    created_from_conversation_id UUID REFERENCES conversations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 12. EVENT_PARTICIPANTS ──────────────────────────────────────────────────
  CREATE TABLE event_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (
      status IN ('invited','accepted','declined','waitlisted','cancelled','attended')
    ),
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    UNIQUE(event_id, user_id)
  );

  -- ─── 13. AUDIT_LOGS ──────────────────────────────────────────────────────────
  CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    before_json JSONB,
    after_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── 14. FEATURE_FLAGS ───────────────────────────────────────────────────────
  CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    rollout_percentage INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ─── INDEXES ─────────────────────────────────────────────────────────────────
  CREATE INDEX idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX idx_conversations_type_status ON conversations(conversation_type, status);
  CREATE INDEX idx_messages_conversation_id ON conversation_messages(conversation_id);
  CREATE INDEX idx_user_memory_user_id ON user_memory(user_id);
  CREATE INDEX idx_user_memory_user_key ON user_memory(user_id, memory_key);
  CREATE INDEX idx_drafts_conversation_id ON drafts(conversation_id);
  CREATE INDEX idx_drafts_user_status ON drafts(user_id, status);
  CREATE INDEX idx_approvals_user_status ON approvals(user_id, status);
  CREATE INDEX idx_events_organizer_id ON events(organizer_id);
  CREATE INDEX idx_events_start_at ON events(start_at);
  CREATE INDEX idx_events_status ON events(status);
  CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
  CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
  CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);

  -- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_courts_updated_at BEFORE UPDATE ON courts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_user_memory_updated_at BEFORE UPDATE ON user_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_drafts_updated_at BEFORE UPDATE ON drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_approvals_updated_at BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER trg_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  -- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
  ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ai_tool_calls ENABLE ROW LEVEL SECURITY;
  ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

  -- Public read policies (no auth required for POC)
  CREATE POLICY "feature_flags_public_read" ON feature_flags FOR SELECT USING (true);
  CREATE POLICY "courts_public_read" ON courts FOR SELECT USING (true);
  CREATE POLICY "events_published_public_read" ON events FOR SELECT USING (status = 'published');

  -- Service role bypasses RLS automatically — no policies needed for server-side writes
  ```
- **GOTCHA**: Courts table must be created BEFORE users table because of the `home_court_id` FK. Migration order matters. If Supabase CLI runs migrations in filename order, the single file approach handles this correctly.
- **GOTCHA**: Do NOT add `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` - the service role key never has a `NEXT_PUBLIC_` prefix.
- **VALIDATE**: `supabase db push` succeeds. All 14 tables visible in Supabase dashboard. RLS column shows "enabled" for all tables.

### Task 12: Create Seed Data
- **ACTION**: Write `supabase/seed.sql` with demo user, 5 courts, 9 memory records, 7 feature flags
- **IMPLEMENT**:

  `supabase/seed.sql`:
  ```sql
  -- Demo user (UUIDs are deterministic for easy reference in code)
  INSERT INTO users (id, name, email, phone)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Alex Chen', 'alex@joola.demo', '+1-555-0100')
  ON CONFLICT (id) DO NOTHING;

  -- 5 Joola pickleball courts
  INSERT INTO courts (id, name, address, latitude, longitude, indoor_outdoor, source) VALUES
    ('00000000-0000-0000-0000-000000000101', 'Joola Court A', '123 Pickleball Ave, San Francisco, CA', 37.7749, -122.4194, 'indoor', 'seed'),
    ('00000000-0000-0000-0000-000000000102', 'Joola Court B', '123 Pickleball Ave, San Francisco, CA', 37.7749, -122.4194, 'indoor', 'seed'),
    ('00000000-0000-0000-0000-000000000103', 'Sunset Recreation Center', '456 Sunset Blvd, San Francisco, CA', 37.7539, -122.4864, 'outdoor', 'seed'),
    ('00000000-0000-0000-0000-000000000104', 'Mission Pickleball Club', '789 Mission St, San Francisco, CA', 37.7599, -122.4148, 'indoor', 'seed'),
    ('00000000-0000-0000-0000-000000000105', 'Golden Gate PB Center', '100 Park Drive, San Francisco, CA', 37.7694, -122.4862, 'outdoor', 'seed')
  ON CONFLICT (id) DO NOTHING;

  -- Set user home court
  UPDATE users SET home_court_id = '00000000-0000-0000-0000-000000000101'
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- User profile
  INSERT INTO user_profiles (user_id, skill_level, dupr_rating, play_style, visibility, profile_completion_percentage)
  VALUES ('00000000-0000-0000-0000-000000000001', 'intermediate', 3.75, 'baseline', 'public', 60)
  ON CONFLICT (user_id) DO NOTHING;

  -- User memory (AI personalization seed)
  INSERT INTO user_memory (user_id, memory_type, memory_key, memory_value_json, confidence_score, source) VALUES
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_event_size',    '8',                                                         0.95, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_day',           '"Saturday"',                                                0.90, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_time',          '"9:00 AM"',                                                 0.90, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_court_id',      '"00000000-0000-0000-0000-000000000101"',                     0.95, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_court_name',    '"Joola Court A"',                                           0.95, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_event_type',    '"doubles"',                                                 0.85, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_duration_hours','1.5',                                                       0.80, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'history',    'events_created_count',    '12',                                                        0.99, 'seed'),
    ('00000000-0000-0000-0000-000000000001', 'context',    'user_timezone',           '"America/Los_Angeles"',                                     0.99, 'seed')
  ON CONFLICT (user_id, memory_key) DO NOTHING;

  -- Feature flags
  INSERT INTO feature_flags (flag_key, enabled, description, rollout_percentage) VALUES
    ('feature_ai_event_creation',       true,  'AI-powered event creation through chat',       100),
    ('feature_ai_profile_creation',     false, 'AI-powered player profile creation',             0),
    ('feature_ai_tournament_creation',  false, 'AI-powered tournament creation',                 0),
    ('feature_weather',                 true,  'Weather integration (stub in POC)',             100),
    ('feature_court_search',            false, 'Real-time court search and availability',        0),
    ('feature_calendar',                false, 'Calendar export and integration',                0),
    ('feature_invites',                 false, 'Automated invite sending',                       0)
  ON CONFLICT (flag_key) DO NOTHING;
  ```
- **GOTCHA**: `memory_value_json` stores JSONB. Numbers and strings need correct JSON encoding: `8` for numbers, `'"Saturday"'` (JSON-encoded string) for strings. The outer single quotes are SQL string delimiters; the inner double quotes are JSON string delimiters.
- **VALIDATE**: After `supabase db reset` (local) or manual SQL execution (cloud), query `SELECT * FROM user_memory WHERE user_id = '00000000-0000-0000-0000-000000000001'` returns 9 rows.

### Task 13: Connect to Supabase Cloud and Deploy to Vercel
- **ACTION**: Link project to Supabase Cloud, push schema, create Vercel project
- **IMPLEMENT**:

  Step 1 — Create Supabase Cloud project:
  ```
  1. Go to supabase.com → New Project
  2. Name: ai-community-poc
  3. Copy Project URL and API keys (anon + service role)
  ```

  Step 2 — Create `.env.local` from template:
  ```bash
  cp .env.local.example .env.local
  # Fill in real values from Supabase dashboard
  ```

  Step 3 — Push schema to cloud:
  ```bash
  supabase login
  supabase link --project-ref <your-project-ref>
  supabase db push
  ```

  Step 4 — Run seed manually via Supabase SQL editor:
  ```
  Paste contents of supabase/seed.sql into Supabase SQL editor → Run
  ```
  (Supabase cloud does not automatically run seed.sql via `db push` — only local `db reset` runs seed)

  Step 5 — Deploy to Vercel:
  ```bash
  npm install -g vercel
  vercel
  # Follow prompts: link to Vercel account, project name: ai-community-poc
  # Add env vars in Vercel dashboard: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_USER_ID, NEXT_PUBLIC_APP_URL
  vercel --prod
  ```
- **GOTCHA**: `SUPABASE_SERVICE_ROLE_KEY` must be added as an environment variable in Vercel dashboard under "Environment Variables" — mark it as "Server" only (not "Browser" exposed).
- **VALIDATE**: Vercel deployment URL shows `/ai-community` placeholder page with teal heading.

### Task 14: Create Component Folder Stubs
- **ACTION**: Create the component folder structure that Phase 4 will populate
- **IMPLEMENT**:
  Create `.gitkeep` files in:
  - `components/ai-chat/.gitkeep`
  - `components/event-draft/.gitkeep`
  - `components/shared/.gitkeep`
  - `components/ui/.gitkeep` (shadcn writes here — may already exist after `shadcn init`)
- **VALIDATE**: `ls components/` shows all 4 directories.

---

## Testing Strategy

### Unit Tests
No unit tests in Phase 1 — pure infrastructure. Phase 3 adds tests alongside services.

### Edge Cases Checklist
- [ ] Migration fails if run twice → `ON CONFLICT DO NOTHING` in seed handles re-runs
- [ ] Missing env vars → Next.js will throw at runtime; document in README
- [ ] Supabase service role exposed to browser → checked via grep (see Task 5 VALIDATE)
- [ ] Feature flags table empty → `isFeatureEnabled` returns `false` (safe default)

---

## Validation Commands

### Type Check
```powershell
npm run type-check
```
EXPECT: `Found 0 errors`

### Build
```powershell
npm run build
```
EXPECT: Successful build, no TypeScript or ESLint errors

### Dev Server
```powershell
npm run dev
```
EXPECT: `localhost:3000` redirects to `/ai-community`, shows teal placeholder page

### Database Schema Validation
```powershell
# After supabase db push
supabase db lint
```
EXPECT: No lint errors

### Seed Validation
```sql
-- Run in Supabase SQL editor
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM courts) AS courts,
  (SELECT COUNT(*) FROM user_memory) AS memory_records,
  (SELECT COUNT(*) FROM feature_flags) AS feature_flags;
```
EXPECT: `users=1, courts=5, memory_records=9, feature_flags=7`

### RLS Validation
```sql
-- Run as anon role in Supabase SQL editor
SET ROLE anon;
SELECT * FROM feature_flags; -- should return rows (public policy)
SELECT * FROM courts;         -- should return rows (public policy)
SELECT * FROM users;          -- should return 0 rows (no anon policy = blocked)
```
EXPECT: feature_flags and courts return data; users returns empty

### Manual Validation
- [ ] `localhost:3000` → redirects to `/ai-community`
- [ ] `/ai-community` → shows "AI Community Assistant" in teal
- [ ] `/events/fake-id` → shows "Event Detail" placeholder
- [ ] Supabase dashboard: 14 tables visible with RLS badge on each
- [ ] Vercel production URL: placeholder page loads

---

## Acceptance Criteria
- [ ] `npm run build` passes with 0 errors
- [ ] `npm run type-check` passes with 0 errors
- [ ] All 14 tables created in Supabase with RLS enabled
- [ ] Seed data loaded: 1 user, 5 courts, 9 memory records, 7 feature flags
- [ ] `localhost:3000` redirects to `/ai-community`
- [ ] Teal brand colours visible on placeholder page
- [ ] `lib/supabase/types.ts` provides typed Row/Insert/Update for all 14 tables
- [ ] `lib/errors.ts` exports `AppError`, `Result<T>`, `ok()`, `err()`
- [ ] `lib/logger/index.ts` exports structured `logger`
- [ ] `lib/config/feature-flags.ts` exports `isFeatureEnabled` and `FLAGS`
- [ ] `lib/constants.ts` exports `DEMO_USER_ID`
- [ ] All feature module folders exist with placeholder index files
- [ ] `.env.local.example` documents all required variables
- [ ] App deployed to Vercel (or confirmed running locally)

## Completion Checklist
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never in a `NEXT_PUBLIC_` variable
- [ ] No `console.log` in lib/ or features/ — only `logger.*`
- [ ] No hardcoded Supabase URLs or keys in source files
- [ ] No hardcoded user IDs in source files (use `DEMO_USER_ID` constant)
- [ ] `audit_logs` Insert type only — no Update defined
- [ ] Seed SQL uses `ON CONFLICT DO NOTHING` for idempotent re-runs
- [ ] All feature placeholders exist with descriptive comments, not empty files

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `supabase db push` fails on Windows due to CLI path issues | M | H | Use `npx supabase` instead of global install; or run SQL manually in Supabase dashboard |
| shadcn `init` conflicts with Tailwind v4 if create-next-app installs it | M | M | Explicitly install Tailwind 3: `npm install tailwindcss@^3 --save-dev` |
| Vercel env vars missing on first deploy | L | H | Checklist in README; `vercel env pull` command documented |
| FK constraint order wrong in migration | L | H | Courts before users in migration file; validated by db push |
| `memory_value_json` data type confusion (JSONB vs TEXT) | M | M | Seed SQL examples show correct JSON encoding for each type |

## Notes
- **Supabase local dev vs cloud**: For POC, use Supabase Cloud directly. Local Supabase Docker adds overhead. Run `supabase db push` against cloud.
- **Type generation**: After Phase 1, you can optionally run `supabase gen types typescript --project-id <id> > lib/supabase/types.generated.ts` to verify the manual types match the schema. They should be identical.
- **Phase 2 handoff**: The AI team should start Phase 2 immediately after Task 11 (schema pushed) — they don't need the Vercel deploy to begin.
- **Phase 3 & 4 handoff**: Both can start after Task 7 (types file created) — services need the DB types; components need only the domain types from `features/events/event.types.ts`.
