import { z } from 'zod'

export const ConversationIntentSchema = z.enum([
  'event_creation', 'tournament_creation', 'profile_creation', 'general', 'clarification',
])
export type ConversationIntent = z.infer<typeof ConversationIntentSchema>

export const ApprovalActionSchema = z.enum([
  'create_event', 'send_invites', 'publish_tournament', 'save_profile',
])
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>

export const EventDraftUpdateSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  event_type: z.enum(['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament']).nullable(),
  sport_type: z.string().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  timezone: z.string().nullable(),
  court_id: z.string().nullable(),
  court_name: z.string().nullable(),
  location_name: z.string().nullable(),
  player_capacity: z.number().int().positive().nullable(),
  visibility: z.enum(['public', 'private', 'invite_only']).nullable(),
})
export type EventDraftUpdate = z.infer<typeof EventDraftUpdateSchema>

export const MemoryUpdateSchema = z.object({
  key: z.string(),
  value: z.string(),
  memory_type: z.string(),
})
export type MemoryUpdate = z.infer<typeof MemoryUpdateSchema>

// ─── PROFILE CREATION SCHEMA (Phase 3) ──────────────────────────────────────
// Mirror of features/profiles/profile.types.ts ProfileDraft but expressed in
// the same `.nullable()`-only style as EventDraftUpdateSchema so OpenAI's
// structured output mode accepts it (every property must be in `required`,
// allowed to be null).
export const ProfileDraftUpdateSchema = z.object({
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  dob: z.string().nullable(),               // YYYY-MM-DD or null
  age_band: z.enum([
    'under_18','18_29','30_39','40_49','50_59','60_plus','prefer_not_to_say',
  ]).nullable(),
  gender: z.enum(['male','female','non_binary','prefer_not_to_say','self_describe']).nullable(),
  home_court_id: z.string().nullable(),
  home_court_name: z.string().nullable(),   // display only
  home_location_text: z.string().nullable(),
  home_latitude: z.number().nullable(),
  home_longitude: z.number().nullable(),
  bio: z.string().nullable(),
  visibility: z.enum(['public','private','friends','friends_only','event_participants']).nullable(),
  // Skill source — when set, the matching rating field must also be populated.
  skill_source: z.enum(['manual','dupr','assessment']).nullable(),
  self_rating: z.number().nullable(),
  dupr_rating: z.number().nullable(),
  dupr_id: z.string().nullable(),
  app_skill_rating: z.number().nullable(),
  skill_label: z.enum(['beginner','developing','intermediate','advanced','expert']).nullable(),
  style_profile: z.string().nullable(),
})
export type ProfileDraftUpdate = z.infer<typeof ProfileDraftUpdateSchema>

// AI signals for the deterministic subflows. AI never EXECUTES these — it
// asks the system to. The chat route runs the actual DUPR lookup / assessment.
export const DuprActionSchema = z.object({
  kind: z.enum(['lookup_by_id','lookup_by_name','skip','none']),
  value: z.string().nullable(),  // dupr_id or name; null for skip/none
})
export type DuprAction = z.infer<typeof DuprActionSchema>

// 'start' → UI switches to assessment Q&A mode (deterministic, not AI-driven)
// 'show_result' → AI is referencing a result already in context
// 'none' → unrelated turn
export const AssessmentActionSchema = z.enum(['start','show_result','none'])
export type AssessmentAction = z.infer<typeof AssessmentActionSchema>

// Additive only — `draft_update` for event_creation untouched; new fields are
// .nullable() so existing AI responses (event mode) that omit them validate
// when the SDK fills them with null.
export const AIResponseSchema = z.object({
  assistant_message: z.string().min(1),
  intent: ConversationIntentSchema,
  draft_update: EventDraftUpdateSchema.nullable(),
  quick_replies: z.array(z.string()).max(4).nullable(),
  tool_calls: z.array(z.string()).nullable(),
  requires_approval: z.boolean(),
  approval_action: ApprovalActionSchema.nullable(),
  missing_fields: z.array(z.string()).nullable(),
  memory_updates: z.array(MemoryUpdateSchema).nullable(),
  // NEW in Phase 3 — profile_creation only. Event-mode responses get null.
  profile_draft_update: ProfileDraftUpdateSchema.nullable(),
  dupr_action: DuprActionSchema.nullable(),
  assessment_action: AssessmentActionSchema.nullable(),
})
export type AIResponse = z.infer<typeof AIResponseSchema>

export function validateAIResponse(raw: unknown): AIResponse | null {
  const result = AIResponseSchema.safeParse(raw)
  return result.success ? result.data : null
}
