import { z } from 'zod'

// Lenient UUID regex — matches the demo user ID format that strict z.uuid() rejects.
const uuidFormat = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const lenientUuid = z.string().regex(uuidFormat, 'Invalid UUID format')

// Coerce non-UUID strings (including empty/null/whitespace) to null instead of
// failing validation. The chat draft may carry stale UUIDs from a prior turn.
const nullableCoercedUuid = z
  .string()
  .nullish()
  .transform(v => {
    if (!v) return null
    return uuidFormat.test(v) ? v : null
  })
  .default(null)

// Same Zod-v4 preprocess pattern proven in event.schema.ts — handles null/undefined
// BEFORE the inner type validator sees it.
const strOrNull = z.preprocess((v) => (v == null || v === '' ? null : v), z.string().nullable())
const strOrDefault = (fallback: string) =>
  z.preprocess((v) => (v == null || v === '' ? fallback : v), z.string())

// Strict date validation: must be a valid past date in YYYY-MM-DD form.
// Uses refine (not transform) so future / invalid dates FAIL validation
// rather than being silently coerced to null.
const dobSchema = z.preprocess(
  (v) => (v == null || v === '' ? null : v),
  z
    .string()
    .nullable()
    .refine(
      (v) => {
        if (v === null) return true
        const trimmed = v.trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false
        const d = new Date(trimmed + 'T00:00:00Z')
        return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now()
      },
      { message: 'Date of birth must be a valid past date in YYYY-MM-DD format' },
    )
    .transform((v) => (v ? v.trim() : null))
    .default(null),
)

export const UserProfileInsertSchema = z.object({
  user_id: lenientUuid,
  display_name: z.string().min(1, 'Display name required').max(100),
  avatar_url: strOrNull,
  dob: dobSchema,
  age_band: z.enum([
    'under_18','18_29','30_39','40_49','50_59','60_plus','prefer_not_to_say',
  ]).nullish().transform(v => v ?? null).default(null),
  gender: z.enum([
    'male','female','non_binary','prefer_not_to_say','self_describe',
  ]).nullish().transform(v => v ?? null).default(null),
  home_court_id: nullableCoercedUuid,
  home_location_text: strOrNull,
  home_latitude: z.number().min(-90).max(90).nullable().default(null),
  home_longitude: z.number().min(-180).max(180).nullable().default(null),
  bio: strOrNull,
  visibility: z.enum([
    'public','private','friends','friends_only','event_participants',
  ]).nullish().transform(v => v ?? 'public').default('public'),
  status: z.enum(['draft','active','suspended','deleted']).nullish().transform(v => v ?? 'active').default('active'),
  source: z.enum(['manual','ai_chat','import']).nullish().transform(v => v ?? 'ai_chat').default('ai_chat'),
  created_from_conversation_id: nullableCoercedUuid,

  // Pass-through fields that already exist on user_profiles. Defaulted nullable
  // because the new chat flow may not fill them.
  skill_level: z.enum(['beginner','intermediate','advanced','pro']).nullish().transform(v => v ?? null).default(null),
  dupr_rating: z.number().min(2.0).max(8.0).nullable().default(null),
  app_skill_rating: z.number().min(1.0).max(5.0).nullable().default(null),
  play_style: strOrNull,
  profile_completion_percentage: z.number().int().min(0).max(100).default(0),
})

export type UserProfileInsertInput = z.infer<typeof UserProfileInsertSchema>

export const PlayerSkillProfileInsertSchema = z.object({
  user_id: lenientUuid,
  self_rating: z.number().min(1.0).max(5.0).nullable().default(null),
  dupr_rating: z.number().min(2.0).max(8.0).nullable().default(null),
  dupr_id: strOrNull,
  dupr_status: z.enum([
    'not_checked','checking','found','not_found','multiple','error','skipped',
  ]).nullish().transform(v => v ?? 'not_checked').default('not_checked'),
  app_skill_rating: z.number().min(1.0).max(5.0).nullable().default(null),
  skill_label: z.enum([
    'beginner','developing','intermediate','advanced','expert',
  ]).nullish().transform(v => v ?? null).default(null),
  skill_source: strOrDefault('manual').pipe(z.enum(['manual','dupr','assessment','mixed','unrated'])),
  style_profile: strOrNull,
  confidence_score: z.number().min(0).max(1).nullable().default(null),
  category_breakdown_json: z.any().nullable().default(null),
  last_assessed_at: strOrNull,
})

export type PlayerSkillProfileInsertInput = z.infer<typeof PlayerSkillProfileInsertSchema>
