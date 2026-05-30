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
  // court and description are optional — omitting them never blocks approval
  return missing
}
