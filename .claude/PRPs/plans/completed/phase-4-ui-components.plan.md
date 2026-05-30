# Plan: Phase 4 — UI Components

## Summary
Build the complete reusable React component library for the AI chat + event draft experience. All 11 components accept props only (no internal data fetching) and use the project's brand color palette, Tailwind v4, `cn()` helper, and CVA variants. No shadcn base components exist yet — every component is built from scratch.

## User Story
As a pickleball organizer, I want a polished chat interface with a live draft panel so that I can see my event taking shape in real time while I converse with the AI.

## Problem → Solution
Placeholder pages at `/ai-community` and `/events/[id]` → Full component library ready for Phase 5 wiring.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/ai-community-assistant-platform.prd.md`
- **PRD Phase**: Phase 4 — UI Components
- **Estimated Files**: 17

---

## UX Design

### Before
```
┌─────────────────────────────────────────┐
│  "AI Community Assistant"               │
│  Joola Pickleball — Event creation chat │
│  Phase 4 UI coming soon                 │
└─────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────┬───────────────────────────┐
│  AI Chat  (bg-soft)          │  Event Draft  (bg-cream)  │
│                              │                           │
│ ┌────────────────────────┐   │ ┌───────────────────────┐ │
│ │ 🤖 How can I help      │   │ │ 🗒 Event Draft         │ │
│ │    today?              │   │ │                       │ │
│ └────────────────────────┘   │ │ Title        —        │ │
│ ┌────────────────────────┐   │ │ Type         —        │ │
│ │ 👤 Set up Saturday     │   │ │ Date & Time  —        │ │
│ │    doubles, 8 players  │   │ │ Court        —        │ │
│ └────────────────────────┘   │ │ Players      —        │ │
│                              │ └───────────────────────┘ │
│  [Yes, Court A] [Other]      │    0% complete            │
│                              │                           │
│ ┌────────────────────────┐   │                           │
│ │ Type a message...   ↑  │   │                           │
│ └────────────────────────┘   │                           │
└──────────────────────────────┴───────────────────────────┘

When approval is ready, right panel becomes:
┌───────────────────────────────────┐
│  ✅ Event Ready for Approval      │
│                                   │
│  Saturday Doubles                 │
│  Doubles · 8 players              │
│  Sat Jun 7, 9:00 AM               │
│  Joola Court A                    │
│                                   │
│  [✓ Approve & Create] [✗ Reject]  │
└───────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `/ai-community` | Placeholder text | `AIChatShell` with two panels | Phase 5 wires live data |
| Chat messages | None | `MessageBubble` variants | user/assistant/tool |
| Quick replies | None | `SmartChips` row | chips from AI response |
| Input | None | `ChatComposer` | Enter or click Send |
| Draft state | None | `LiveDraftPanel` | field-by-field with % |
| Approval moment | None | `ApprovalCard` | approve/reject buttons |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/utils.ts` | all | `cn()` is used in every component |
| P0 | `app/globals.css` | 1-85 | All brand color tokens and CSS vars |
| P0 | `features/ai/structured-output-schema.ts` | all | `AIResponse`, `EventDraftUpdate` types consumed by components |
| P1 | `lib/errors.ts` | all | `Result<T>` shape — ApprovalCard callbacks return this |
| P1 | `features/events/event.service.ts` | all | EventRow shape and service Result<T> pattern |
| P2 | `app/ai-community/page.tsx` | all | Where AIChatShell will be mounted in Phase 6 |
| P2 | `package.json` | 14-27 | Confirm `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` are available |

## External Documentation
| Topic | Source | Key Takeaway |
|---|---|---|
| CVA usage | installed package | `cva()` function + `VariantProps` type helper |
| Tailwind v4 | app/globals.css | Inline `@theme` variables — use `bg-soft`, `bg-cream`, `text-primary`, etc. |
| lucide-react | installed package | `import { Send, Check, X, Brain, MapPin, Clock, Users } from 'lucide-react'` |

---

## Patterns to Mirror

### COMPONENT_NAMING
```typescript
// SOURCE: app/ai-community/page.tsx:1
// PascalCase file + function name; default export
export default function AICommunityPage() {
  return <main className="min-h-screen bg-soft ...">
```

### TAILWIND_BRAND_COLORS
```typescript
// SOURCE: app/globals.css:6-14
// Brand tokens available as Tailwind utilities:
// bg-primary   text-primary   (#01625B deep teal)
// bg-secondary text-secondary (#027D74 mid teal)
// bg-soft      text-soft      (#E8F4F2 light teal bg)
// bg-cream     text-cream     (#F7F2E8)
// bg-warm      text-warm      (#FFF8ED)
// text-ink                    (#1F2933)
// text-muted                  (#697586)
```

### CN_HELPER
```typescript
// SOURCE: lib/utils.ts:1-6
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// Usage: cn("base-class", condition && "conditional-class", props.className)
```

### CVA_PATTERN
```typescript
// Pattern: use CVA for components with multiple variants
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        published: 'bg-primary text-white',
        draft:     'bg-muted-bg text-muted-fg',
        pending:   'bg-warm text-ink',
      },
    },
    defaultVariants: { variant: 'draft' },
  }
)
```

### CLIENT_COMPONENT_WITH_HANDLERS
```typescript
// SOURCE: app/ai-community/page.tsx convention
// Interactive components (onClick, onChange) need 'use client'
'use client'

import { cn } from '@/lib/utils'

interface MyComponentProps {
  onAction: () => void
  className?: string
}

export function MyComponent({ onAction, className }: MyComponentProps) {
  return (
    <div className={cn('base styles', className)}>
      <button onClick={onAction}>...</button>
    </div>
  )
}
```

### BARREL_EXPORT
```typescript
// SOURCE: features/events/index.ts pattern
// Each directory has an index.ts that re-exports all public items
export * from './StatusBadge'
export * from './AIOptionCard'
```

### ICON_USAGE
```typescript
// lucide-react icons — import individually for tree-shaking
import { Send, Check, X, Brain, MapPin, Clock, Users, ChevronRight, AlertCircle } from 'lucide-react'
// Use: <Send className="h-4 w-4" />
```

### TEST_STRUCTURE
```typescript
// SOURCE: features/events/__tests__/event.service.test.ts:1
import { describe, test, expect } from 'bun:test'

describe('ComponentGroup', () => {
  test('description of what is being tested', () => {
    expect(typeof ComponentName).toBe('function')
  })
})
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `components/shared/StatusBadge.tsx` | CREATE | CVA badge for published/draft/pending/approved/rejected/cancelled |
| `components/shared/AIOptionCard.tsx` | CREATE | Court or time slot suggestion card |
| `components/shared/MemorySuggestionCard.tsx` | CREATE | Memory-based pre-fill suggestion |
| `components/shared/ToolResultCard.tsx` | CREATE | AI tool execution status and summary |
| `components/shared/index.ts` | CREATE | Barrel export |
| `components/ai-chat/MessageBubble.tsx` | CREATE | user/assistant/tool message variants |
| `components/ai-chat/SmartChips.tsx` | CREATE | Quick reply chip row |
| `components/ai-chat/ChatComposer.tsx` | CREATE | Text input + send button |
| `components/ai-chat/AIChatShell.tsx` | CREATE | Two-column layout shell |
| `components/ai-chat/index.ts` | CREATE | Barrel export |
| `components/event-draft/EntityPreviewCard.tsx` | CREATE | Key-value preview card |
| `components/event-draft/LiveDraftPanel.tsx` | CREATE | Field-by-field draft with progress ring |
| `components/event-draft/ApprovalCard.tsx` | CREATE | Full event preview + approve/reject |
| `components/event-draft/index.ts` | CREATE | Barrel export |
| `components/shared/__tests__/shared.test.ts` | CREATE | 4 export-shape tests |
| `components/ai-chat/__tests__/ai-chat.test.ts` | CREATE | 4 export-shape tests |
| `components/event-draft/__tests__/event-draft.test.ts` | CREATE | 3 export-shape tests |

## NOT Building
- shadcn/ui base components (Button, Card, Input) — we write custom Tailwind from scratch
- Storybook setup — visual validation via `bun run dev` + type-check
- Real-time WebSocket subscription — Phase 5 wires data; components receive props
- Mobile responsive breakpoints — web-first per PRD
- Dark mode variants — light mode only for POC
- Animations beyond CSS transitions — keep it simple for POC
- `components/ui/` directory components — reserved for future shadcn install

---

## Step-by-Step Tasks

### Task 1: Create StatusBadge
- **ACTION**: CREATE `components/shared/StatusBadge.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { cva, type VariantProps } from 'class-variance-authority'
  import { cn } from '@/lib/utils'

  const badgeVariants = cva(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
    {
      variants: {
        variant: {
          published:  'bg-primary text-white',
          draft:      'bg-muted-bg text-muted-fg border border-border',
          pending:    'bg-warm text-ink border border-amber-200',
          approved:   'bg-green-100 text-green-800',
          rejected:   'bg-red-100 text-red-700',
          cancelled:  'bg-gray-100 text-gray-500',
        },
      },
      defaultVariants: { variant: 'draft' },
    }
  )

  export type StatusBadgeVariant = 'published' | 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'

  export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
    status: StatusBadgeVariant
    className?: string
  }

  const LABELS: Record<StatusBadgeVariant, string> = {
    published: 'Published',
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  }

  export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
      <span className={cn(badgeVariants({ variant: status }), className)}>
        {LABELS[status]}
      </span>
    )
  }
  ```
- **MIRROR**: CVA_PATTERN, CN_HELPER
- **IMPORTS**: `cva`, `VariantProps` from `class-variance-authority`; `cn` from `@/lib/utils`
- **GOTCHA**: Tailwind v4 does NOT use `tailwind.config.ts` — all tokens are in `@theme inline` in `globals.css`. Use utility class names like `bg-primary`, `text-muted-fg`, `bg-muted-bg`. Do NOT use arbitrary values like `bg-[#01625B]`.
- **VALIDATE**: `bun run type-check` — zero errors

### Task 2: Create AIOptionCard
- **ACTION**: CREATE `components/shared/AIOptionCard.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { cn } from '@/lib/utils'

  export interface AIOptionCardProps {
    title: string
    subtitle?: string
    badge?: string
    onSelect: () => void
    isSelected?: boolean
    className?: string
  }

  export function AIOptionCard({ title, subtitle, badge, onSelect, isSelected = false, className }: AIOptionCardProps) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'w-full text-left rounded-xl border p-3 transition-all duration-150',
          'hover:border-primary hover:bg-soft',
          isSelected
            ? 'border-primary bg-soft ring-1 ring-primary'
            : 'border-border bg-white',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
          </div>
          {badge && (
            <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-xs font-medium text-secondary">
              {badge}
            </span>
          )}
        </div>
      </button>
    )
  }
  ```
- **MIRROR**: CLIENT_COMPONENT_WITH_HANDLERS, CN_HELPER, TAILWIND_BRAND_COLORS
- **IMPORTS**: `cn` from `@/lib/utils`
- **GOTCHA**: Use `type="button"` on all non-submit buttons inside forms to prevent accidental form submission.
- **VALIDATE**: `bun run type-check`

### Task 3: Create MemorySuggestionCard
- **ACTION**: CREATE `components/shared/MemorySuggestionCard.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { Brain } from 'lucide-react'
  import { cn } from '@/lib/utils'

  export interface MemorySuggestionCardProps {
    label: string
    value: string
    onAccept: () => void
    onDismiss?: () => void
    className?: string
  }

  export function MemorySuggestionCard({ label, value, onAccept, onDismiss, className }: MemorySuggestionCardProps) {
    return (
      <div className={cn('flex items-start gap-3 rounded-xl border border-amber-200 bg-warm p-3', className)}>
        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-secondary"
          >
            Use
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    )
  }
  ```
- **MIRROR**: CLIENT_COMPONENT_WITH_HANDLERS, ICON_USAGE, CN_HELPER
- **IMPORTS**: `Brain` from `lucide-react`; `cn` from `@/lib/utils`
- **GOTCHA**: `bg-warm` is `#FFF8ED` — a warm cream. Do not confuse with `bg-cream` (`#F7F2E8`). Both are defined in `globals.css` `@theme inline`.
- **VALIDATE**: `bun run type-check`

### Task 4: Create ToolResultCard
- **ACTION**: CREATE `components/shared/ToolResultCard.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { Check, Loader2, AlertCircle } from 'lucide-react'
  import { cn } from '@/lib/utils'

  export type ToolStatus = 'running' | 'completed' | 'failed'

  export interface ToolResultCardProps {
    toolName: string
    status: ToolStatus
    summary?: string
    className?: string
  }

  const STATUS_CONFIG: Record<ToolStatus, { icon: React.ReactNode; label: string; style: string }> = {
    running:   { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Running', style: 'text-secondary' },
    completed: { icon: <Check className="h-3.5 w-3.5" />, label: 'Done', style: 'text-green-700' },
    failed:    { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Failed', style: 'text-red-600' },
  }

  export function ToolResultCard({ toolName, status, summary, className }: ToolResultCardProps) {
    const cfg = STATUS_CONFIG[status]
    return (
      <div className={cn('flex items-start gap-2 rounded-lg border border-border bg-white px-3 py-2', className)}>
        <span className={cn('mt-0.5 shrink-0', cfg.style)} aria-hidden="true">{cfg.icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{toolName}</p>
          {summary && <p className="mt-0.5 text-xs text-ink">{summary}</p>}
        </div>
        <span className={cn('ml-auto shrink-0 text-xs font-medium', cfg.style)}>{cfg.label}</span>
      </div>
    )
  }
  ```
- **MIRROR**: ICON_USAGE, CLIENT_COMPONENT_WITH_HANDLERS, CN_HELPER
- **IMPORTS**: `Check, Loader2, AlertCircle` from `lucide-react`; `cn` from `@/lib/utils`
- **GOTCHA**: `animate-spin` requires `tailwindcss-animate` plugin which is already imported via `@plugin "tailwindcss-animate"` in `globals.css`.
- **VALIDATE**: `bun run type-check`

### Task 5: Create shared/index.ts
- **ACTION**: CREATE `components/shared/index.ts`
- **IMPLEMENT**:
  ```typescript
  export * from './StatusBadge'
  export * from './AIOptionCard'
  export * from './MemorySuggestionCard'
  export * from './ToolResultCard'
  ```
- **MIRROR**: BARREL_EXPORT
- **IMPORTS**: none
- **GOTCHA**: Export everything including types (`StatusBadgeVariant`, `ToolStatus`, etc.) — consumers need the types.
- **VALIDATE**: `bun run type-check`

### Task 6: Create MessageBubble
- **ACTION**: CREATE `components/ai-chat/MessageBubble.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { Loader2 } from 'lucide-react'
  import { cn } from '@/lib/utils'

  export type MessageRole = 'user' | 'assistant' | 'tool'

  export interface MessageBubbleProps {
    role: MessageRole
    content: string
    timestamp?: string
    toolName?: string
    isLoading?: boolean
    className?: string
  }

  export function MessageBubble({ role, content, timestamp, toolName, isLoading = false, className }: MessageBubbleProps) {
    const isUser = role === 'user'
    const isTool = role === 'tool'

    return (
      <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start', className)}>
        <div
          className={cn(
            'max-w-[80%] rounded-2xl px-4 py-2.5',
            isUser && 'rounded-br-sm bg-primary text-white',
            !isUser && !isTool && 'rounded-bl-sm bg-white text-ink shadow-sm border border-border',
            isTool && 'rounded-lg border border-border bg-muted-bg px-3 py-2 text-muted'
          )}
        >
          {isTool && toolName && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{toolName}</p>
          )}
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
              <span className="text-sm text-muted">Thinking…</span>
            </div>
          ) : (
            <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', isTool && 'text-xs')}>{content}</p>
          )}
          {timestamp && (
            <p className={cn('mt-1 text-[10px]', isUser ? 'text-white/60' : 'text-muted')}>{timestamp}</p>
          )}
        </div>
      </div>
    )
  }
  ```
- **MIRROR**: CLIENT_COMPONENT_WITH_HANDLERS, CN_HELPER, TAILWIND_BRAND_COLORS
- **IMPORTS**: `Loader2` from `lucide-react`; `cn` from `@/lib/utils`
- **GOTCHA**: `text-white/60` uses Tailwind opacity modifier — this works with Tailwind v4. `whitespace-pre-wrap` preserves newlines in AI messages.
- **VALIDATE**: `bun run type-check`

### Task 7: Create SmartChips
- **ACTION**: CREATE `components/ai-chat/SmartChips.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { cn } from '@/lib/utils'

  export interface SmartChipsProps {
    chips: string[]
    onSelect: (chip: string) => void
    disabled?: boolean
    className?: string
  }

  export function SmartChips({ chips, onSelect, disabled = false, className }: SmartChipsProps) {
    if (chips.length === 0) return null

    return (
      <div className={cn('flex flex-wrap gap-2 py-1', className)} role="group" aria-label="Quick reply options">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSelect(chip)}
            disabled={disabled}
            className={cn(
              'rounded-full border border-primary px-3.5 py-1.5 text-sm font-medium text-primary',
              'transition-colors duration-150',
              'hover:bg-primary hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {chip}
          </button>
        ))}
      </div>
    )
  }
  ```
- **MIRROR**: CLIENT_COMPONENT_WITH_HANDLERS, CN_HELPER, TAILWIND_BRAND_COLORS
- **IMPORTS**: `cn` from `@/lib/utils`
- **GOTCHA**: Return `null` for empty chips — callers may pass an empty array when the AI response has no quick replies; avoid rendering an empty row.
- **VALIDATE**: `bun run type-check`

### Task 8: Create ChatComposer
- **ACTION**: CREATE `components/ai-chat/ChatComposer.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { Send, Loader2 } from 'lucide-react'
  import { cn } from '@/lib/utils'

  export interface ChatComposerProps {
    value: string
    onChange: (value: string) => void
    onSend: () => void
    placeholder?: string
    disabled?: boolean
    isLoading?: boolean
    className?: string
  }

  export function ChatComposer({
    value,
    onChange,
    onSend,
    placeholder = 'Type a message…',
    disabled = false,
    isLoading = false,
    className,
  }: ChatComposerProps) {
    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (value.trim()) onSend()
      }
    }

    const canSend = value.trim().length > 0 && !disabled && !isLoading

    return (
      <div className={cn('flex items-end gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm', className)}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-xl bg-transparent px-2 py-1.5',
            'text-sm text-ink placeholder:text-muted',
            'focus:outline-none',
            'disabled:opacity-50',
            'max-h-32 overflow-y-auto'
          )}
          aria-label="Chat message input"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            'transition-all duration-150',
            canSend
              ? 'bg-primary text-white hover:bg-secondary'
              : 'bg-muted-bg text-muted cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    )
  }
  ```
- **MIRROR**: CLIENT_COMPONENT_WITH_HANDLERS, ICON_USAGE, CN_HELPER
- **IMPORTS**: `Send, Loader2` from `lucide-react`; `cn` from `@/lib/utils`
- **GOTCHA**: `Shift+Enter` should insert a newline (not send). The `handleKeyDown` guard `!e.shiftKey` ensures this. Use `textarea` not `input` to allow multiline messages.
- **VALIDATE**: `bun run type-check`

### Task 9: Create AIChatShell
- **ACTION**: CREATE `components/ai-chat/AIChatShell.tsx`
- **IMPLEMENT**:
  ```tsx
  import { cn } from '@/lib/utils'

  export interface AIChatShellProps {
    chatContent: React.ReactNode
    draftContent: React.ReactNode
    className?: string
  }

  export function AIChatShell({ chatContent, draftContent, className }: AIChatShellProps) {
    return (
      <div className={cn('flex h-screen overflow-hidden', className)}>
        {/* Left: Chat column */}
        <div className="flex flex-1 flex-col bg-soft">
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
            {chatContent}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" aria-hidden="true" />

        {/* Right: Draft panel */}
        <div className="w-[400px] shrink-0 overflow-y-auto bg-cream">
          {draftContent}
        </div>
      </div>
    )
  }
  ```
- **MIRROR**: COMPONENT_NAMING, CN_HELPER, TAILWIND_BRAND_COLORS
- **IMPORTS**: `cn` from `@/lib/utils`
- **GOTCHA**: `AIChatShell` is a **Server Component** (no `'use client'`) because it only does layout — no event handlers or state. Keeping it as a Server Component means the shell renders on the server while children can be Client Components. Do NOT add `'use client'` to this file.
- **VALIDATE**: `bun run type-check`

### Task 10: Create ai-chat/index.ts
- **ACTION**: CREATE `components/ai-chat/index.ts`
- **IMPLEMENT**:
  ```typescript
  export * from './AIChatShell'
  export * from './MessageBubble'
  export * from './SmartChips'
  export * from './ChatComposer'
  ```
- **MIRROR**: BARREL_EXPORT
- **VALIDATE**: `bun run type-check`

### Task 11: Create EntityPreviewCard
- **ACTION**: CREATE `components/event-draft/EntityPreviewCard.tsx`
- **IMPLEMENT**:
  ```tsx
  import { cn } from '@/lib/utils'

  export interface EntityPreviewField {
    label: string
    value: string | number | null | undefined
  }

  export interface EntityPreviewCardProps {
    title: string
    fields: EntityPreviewField[]
    className?: string
  }

  export function EntityPreviewCard({ title, fields, className }: EntityPreviewCardProps) {
    return (
      <div className={cn('rounded-xl border border-border bg-white p-4 shadow-sm', className)}>
        <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
        <dl className="space-y-2">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0 text-xs text-muted">{label}</dt>
              <dd className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {value != null && value !== '' ? String(value) : (
                  <span className="text-muted italic">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }
  ```
- **MIRROR**: COMPONENT_NAMING, CN_HELPER
- **IMPORTS**: `cn` from `@/lib/utils`
- **GOTCHA**: Server Component (no `'use client'`) — no event handlers. Uses `<dl>/<dt>/<dd>` semantic HTML for key-value data.
- **VALIDATE**: `bun run type-check`

### Task 12: Create LiveDraftPanel
- **ACTION**: CREATE `components/event-draft/LiveDraftPanel.tsx`
- **IMPLEMENT**:
  ```tsx
  import { Check } from 'lucide-react'
  import { cn } from '@/lib/utils'

  export interface DraftField {
    label: string
    value: string | number | null | undefined
    isRequired: boolean
  }

  export interface LiveDraftPanelProps {
    fields: DraftField[]
    completionPct: number
    missingFields: string[]
    className?: string
  }

  export function LiveDraftPanel({ fields, completionPct, missingFields, className }: LiveDraftPanelProps) {
    return (
      <div className={cn('flex h-full flex-col p-5', className)}>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Event Draft</h2>
          <span className="text-xs font-medium text-muted">{completionPct}% complete</span>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${completionPct}%` }}
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {fields.map(({ label, value, isRequired }) => {
            const isFilled = value != null && value !== ''
            return (
              <div key={label} className="flex items-start gap-3">
                <div className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                  isFilled ? 'bg-primary' : isRequired ? 'border-2 border-muted-fg' : 'border border-border'
                )}>
                  {isFilled && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{label}{isRequired && !isFilled && ' *'}</p>
                  <p className={cn('text-sm', isFilled ? 'font-medium text-ink' : 'italic text-muted')}>
                    {isFilled ? String(value) : '—'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Missing fields summary */}
        {missingFields.length > 0 && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-warm px-3 py-2.5">
            <p className="text-xs font-medium text-amber-700">Still needed:</p>
            <p className="mt-0.5 text-xs text-amber-600">{missingFields.join(', ')}</p>
          </div>
        )}
      </div>
    )
  }
  ```
- **MIRROR**: COMPONENT_NAMING, CN_HELPER, ICON_USAGE
- **IMPORTS**: `Check` from `lucide-react`; `cn` from `@/lib/utils`
- **GOTCHA**: Server Component (no `'use client'`). The `style={{ width: ... }}` inline style is needed because Tailwind v4 cannot generate dynamic `w-[{n}%]` values at runtime. This is the correct approach — do NOT try to map percentages to static Tailwind classes.
- **VALIDATE**: `bun run type-check`

### Task 13: Create ApprovalCard
- **ACTION**: CREATE `components/event-draft/ApprovalCard.tsx`
- **IMPLEMENT**:
  ```tsx
  'use client'
  import { Check, X, Calendar, MapPin, Users, Activity, Loader2 } from 'lucide-react'
  import { cn } from '@/lib/utils'

  export interface ApprovalCardProps {
    title: string
    eventType: string
    startAt: string
    courtName?: string | null
    playerCapacity: number
    description?: string | null
    missingFields?: string[]
    onApprove: () => void
    onReject: () => void
    isApproving?: boolean
    className?: string
  }

  export function ApprovalCard({
    title,
    eventType,
    startAt,
    courtName,
    playerCapacity,
    description,
    missingFields = [],
    onApprove,
    onReject,
    isApproving = false,
    className,
  }: ApprovalCardProps) {
    const formattedType = eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    return (
      <div className={cn(
        'flex flex-col gap-4 rounded-2xl border-2 border-primary bg-white p-5 shadow-md',
        className
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Ready to Create</p>
            <h3 className="mt-1 text-lg font-bold text-ink">{title}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-soft px-3 py-1 text-xs font-medium text-secondary">
            {formattedType}
          </span>
        </div>

        {/* Event details */}
        <dl className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{startAt}</span>
          </div>
          {courtName && (
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="text-sm text-ink">{courtName}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{playerCapacity} players</span>
          </div>
          {description && (
            <div className="flex items-start gap-2.5">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="text-sm text-ink">{description}</span>
            </div>
          )}
        </dl>

        {/* Missing fields warning */}
        {missingFields.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-warm px-3 py-2">
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Optional fields missing:</span>{' '}
              {missingFields.join(', ')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={isApproving}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5',
              'text-sm font-semibold text-white transition-colors',
              'hover:bg-secondary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isApproving && 'cursor-not-allowed opacity-70'
            )}
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {isApproving ? 'Creating…' : 'Approve & Create'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isApproving}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5',
              'text-sm font-medium text-muted transition-colors',
              'hover:border-red-300 hover:text-red-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2',
              isApproving && 'cursor-not-allowed opacity-50'
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Reject
          </button>
        </div>
      </div>
    )
  }
  ```
- **MIRROR**: CLIENT_COMPONENT_WITH_HANDLERS, ICON_USAGE, CN_HELPER, TAILWIND_BRAND_COLORS
- **IMPORTS**: `Check, X, Calendar, MapPin, Users, Activity, Loader2` from `lucide-react`; `cn` from `@/lib/utils`
- **GOTCHA**: `onApprove` is async in Phase 5 — the parent manages `isApproving` state; the component itself is pure/presentational. Use semantic `<dl>` for event metadata.
- **VALIDATE**: `bun run type-check`

### Task 14: Create event-draft/index.ts
- **ACTION**: CREATE `components/event-draft/index.ts`
- **IMPLEMENT**:
  ```typescript
  export * from './EntityPreviewCard'
  export * from './LiveDraftPanel'
  export * from './ApprovalCard'
  ```
- **MIRROR**: BARREL_EXPORT
- **VALIDATE**: `bun run type-check`

### Task 15: Write shared component tests
- **ACTION**: CREATE `components/shared/__tests__/shared.test.ts`
- **IMPLEMENT**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { StatusBadge } from '../StatusBadge'
  import { AIOptionCard } from '../AIOptionCard'
  import { MemorySuggestionCard } from '../MemorySuggestionCard'
  import { ToolResultCard } from '../ToolResultCard'

  describe('shared components', () => {
    test('StatusBadge is a function', () => {
      expect(typeof StatusBadge).toBe('function')
    })

    test('AIOptionCard is a function', () => {
      expect(typeof AIOptionCard).toBe('function')
    })

    test('MemorySuggestionCard is a function', () => {
      expect(typeof MemorySuggestionCard).toBe('function')
    })

    test('ToolResultCard is a function', () => {
      expect(typeof ToolResultCard).toBe('function')
    })
  })
  ```
- **MIRROR**: TEST_STRUCTURE
- **GOTCHA**: No `jsdom` is configured — do NOT attempt `render()`. These are export-shape tests only.
- **VALIDATE**: `bun test components/shared/__tests__/shared.test.ts`

### Task 16: Write ai-chat component tests
- **ACTION**: CREATE `components/ai-chat/__tests__/ai-chat.test.ts`
- **IMPLEMENT**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { AIChatShell } from '../AIChatShell'
  import { MessageBubble } from '../MessageBubble'
  import { SmartChips } from '../SmartChips'
  import { ChatComposer } from '../ChatComposer'

  describe('ai-chat components', () => {
    test('AIChatShell is a function', () => {
      expect(typeof AIChatShell).toBe('function')
    })

    test('MessageBubble is a function', () => {
      expect(typeof MessageBubble).toBe('function')
    })

    test('SmartChips is a function', () => {
      expect(typeof SmartChips).toBe('function')
    })

    test('ChatComposer is a function', () => {
      expect(typeof ChatComposer).toBe('function')
    })
  })
  ```
- **MIRROR**: TEST_STRUCTURE
- **GOTCHA**: Same no-render constraint. Export-shape test only.
- **VALIDATE**: `bun test components/ai-chat/__tests__/ai-chat.test.ts`

### Task 17: Write event-draft component tests
- **ACTION**: CREATE `components/event-draft/__tests__/event-draft.test.ts`
- **IMPLEMENT**:
  ```typescript
  import { describe, test, expect } from 'bun:test'
  import { EntityPreviewCard } from '../EntityPreviewCard'
  import { LiveDraftPanel } from '../LiveDraftPanel'
  import { ApprovalCard } from '../ApprovalCard'

  describe('event-draft components', () => {
    test('EntityPreviewCard is a function', () => {
      expect(typeof EntityPreviewCard).toBe('function')
    })

    test('LiveDraftPanel is a function', () => {
      expect(typeof LiveDraftPanel).toBe('function')
    })

    test('ApprovalCard is a function', () => {
      expect(typeof ApprovalCard).toBe('function')
    })
  })
  ```
- **MIRROR**: TEST_STRUCTURE
- **GOTCHA**: Same no-render constraint.
- **VALIDATE**: `bun test components/event-draft/__tests__/event-draft.test.ts`

### Task 18: Run full validation
- **ACTION**: Run all validation commands
- **IMPLEMENT**: Sequential:
  1. `bun run type-check` — expect zero errors
  2. `bun test components/` — expect 11 tests pass
  3. `bun run build` — expect clean Turbopack build
- **GOTCHA**: If type-check fails on a `React.ReactNode` usage, add `import type React from 'react'` to the file. With React 19 + Next.js 16, the global JSX namespace is active so explicit React imports are not required for JSX — but they ARE needed for `React.ReactNode` type references in non-JSX files.
- **VALIDATE**: All green before moving to report.

---

## Testing Strategy

### Tests (all export-shape, no render required)

| Test File | Tests | Coverage |
|---|---|---|
| `components/shared/__tests__/shared.test.ts` | 4 | StatusBadge, AIOptionCard, MemorySuggestionCard, ToolResultCard export |
| `components/ai-chat/__tests__/ai-chat.test.ts` | 4 | AIChatShell, MessageBubble, SmartChips, ChatComposer export |
| `components/event-draft/__tests__/event-draft.test.ts` | 3 | EntityPreviewCard, LiveDraftPanel, ApprovalCard export |

**Total: 11 tests**

### Edge Cases Checklist
- [x] `SmartChips` with empty array → returns null (no empty row rendered)
- [x] `MessageBubble` with `isLoading=true` → shows spinner instead of content
- [x] `LiveDraftPanel` with `completionPct=0` → progress bar 0%, no filled checkmarks
- [x] `ApprovalCard` with `missingFields=[]` → no warning box rendered
- [x] `ApprovalCard` with `isApproving=true` → both buttons disabled, "Creating…" label
- [x] `EntityPreviewCard` with `value=null` → renders em dash
- [x] `ToolResultCard` status=`running` → animated spinner shown

---

## Validation Commands

### Static Analysis
```powershell
bun run type-check
```
EXPECT: Zero type errors across all 17 new files

### Unit Tests
```powershell
bun test components/
```
EXPECT: 11 tests pass, 0 fail

### Build
```powershell
bun run build
```
EXPECT: Clean Turbopack build — no errors, no type errors

### Manual Visual Validation (required)
```powershell
bun run dev
```
Then open http://localhost:3000/ai-community — renders the placeholder page (Phase 6 will wire it up). Phase 4 visual check is done by temporarily importing components in the page.

---

## Acceptance Criteria
- [x] All 11 components created across 3 directories
- [x] All 4 barrel `index.ts` files created
- [x] 3 test files with 11 tests, all passing
- [x] `bun run type-check` → zero errors
- [x] `bun run build` → clean build
- [x] No internal data fetching in any component (props only)
- [x] Brand colors used from `globals.css` tokens (not hardcoded hex values)
- [x] `cn()` helper used for all className merging
- [x] CVA used for `StatusBadge` variants
- [x] Interactive components have `'use client'` directive
- [x] Layout-only components are Server Components (no `'use client'`)

## Completion Checklist
- [ ] `'use client'` on all interactive components (MessageBubble, SmartChips, ChatComposer, ApprovalCard, AIOptionCard, MemorySuggestionCard, ToolResultCard, StatusBadge)
- [ ] NO `'use client'` on layout/display-only components (AIChatShell, LiveDraftPanel, EntityPreviewCard)
- [ ] `type="button"` on all non-submit buttons
- [ ] `aria-label` on icon-only buttons (send button, approve/reject)
- [ ] All nullable props typed as `| null | undefined` not just `| null`
- [ ] No hardcoded color hex values — use Tailwind brand utilities
- [ ] No `console.log` statements
- [ ] No unused imports

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `React.ReactNode` type error without import | M | L | Add `import type React from 'react'` to AIChatShell |
| Tailwind v4 class not found for brand token | L | M | Check `globals.css` @theme for exact variable name before use |
| CVA peer dependency mismatch | L | H | CVA 0.7.1 is already in package.json — no install needed |
| `animate-spin` not working | L | L | Verify `@plugin "tailwindcss-animate"` is in globals.css (it is) |

## Notes
- **No shadcn component install needed** — CVA, clsx, tailwind-merge are already installed.
- **Tailwind v4 token names**: Brand tokens are defined in `globals.css` as `--color-primary`, `--color-soft`, etc., which become `bg-primary`, `bg-soft` Tailwind utilities. The `bg-muted-bg` maps to `var(--muted)` and `text-muted-fg` maps to `var(--muted-foreground)`.
- **React 19 JSX transform** — no `import React from 'react'` needed in `.tsx` files. Only add `import type React from 'react'` when referencing `React.ReactNode` as a type.
- **AIChatShell width**: Draft panel is fixed at `w-[400px]`; chat column takes remaining flex space. This is intentional — Phase 5 can override via className if needed.
- **onefiftyplus.com theme**: Chat shell = soft teal bg; assistant bubbles = white on soft teal; user bubbles = primary teal; draft panel = cream; approval card = white with primary border.
