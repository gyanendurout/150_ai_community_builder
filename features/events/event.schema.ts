import { z } from 'zod'

// Lenient UUID: matches 8-4-4-4-12 hex format without enforcing RFC 4122 version/variant bits.
// Zod v4 z.string().uuid() rejects zero-version UUIDs (like the demo user ID 00000000-...).
const uuidFormat = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const lenientUuid = z.string().regex(uuidFormat, 'Invalid UUID format')

// Nullable UUID that coerces non-UUID strings to null rather than failing validation.
const nullableCoercedUuid = z
  .string()
  .nullish()
  .transform(v => {
    if (!v) return null
    return uuidFormat.test(v) ? v : null
  })
  .default(null)

// Coerce null/undefined to a string default.
// z.preprocess runs BEFORE Zod type validation, so null/undefined are replaced
// with the fallback before z.string() ever sees them (Zod v4 compatible).
const strOrDefault = (fallback: string) =>
  z.preprocess((v) => (v == null ? fallback : v), z.string())

export const EventInsertSchema = z.object({
  organizer_id: lenientUuid,
  title: z.string().min(1).max(200),
  description: z.string().nullable().default(null),
  event_type: z.enum(['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament']).nullish().transform(v => v ?? null).default(null),
  sport_type: strOrDefault('pickleball'),
  start_at: z.string(),
  end_at: z.string().nullable().default(null),
  timezone: strOrDefault('UTC'),
  court_id: nullableCoercedUuid,
  location_name: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  player_capacity: z.number().int().positive(),
  visibility: z.enum(['public', 'private', 'invite_only']).nullish().transform(v => v ?? 'public').default('public'),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).nullish().transform(v => v ?? 'published').default('published'),
  source: z.enum(['ai_chat', 'manual', 'import']).nullish().transform(v => v ?? 'ai_chat').default('ai_chat'),
  created_from_conversation_id: nullableCoercedUuid,
})

export type EventInsertInput = z.infer<typeof EventInsertSchema>
