import type {
  UserProfileRow,
  PlayerSkillProfileRow,
  AssessmentResultRow,
} from '@/lib/supabase/types'

export type ProfileVisibility =
  | 'public'
  | 'private'
  | 'friends'
  | 'friends_only'
  | 'event_participants'

export type AgeBand =
  | 'under_18' | '18_29' | '30_39' | '40_49' | '50_59' | '60_plus' | 'prefer_not_to_say'

export type Gender =
  | 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'self_describe'

export type ProfileStatus = 'draft' | 'active' | 'suspended' | 'deleted'

// What the chat draft persists into drafts.draft_json when entity_type='profile'.
// Mirrors the structure of UserProfile + skill source — every field optional
// so partial drafts are valid (UI shows missing-fields nudges).
export interface ProfileDraft {
  display_name?: string
  avatar_url?: string
  dob?: string                   // ISO date string YYYY-MM-DD
  age_band?: AgeBand
  gender?: Gender
  home_court_id?: string
  home_court_name?: string       // display-only — not persisted to user_profiles
  home_location_text?: string
  home_latitude?: number
  home_longitude?: number
  bio?: string
  visibility?: ProfileVisibility
  // Skill source — exactly ONE of these must be set when saving.
  skill_source?: 'manual' | 'dupr' | 'assessment'
  self_rating?: number           // 1.0..5.0 if skill_source='manual'
  dupr_rating?: number           // 2.0..8.0 if skill_source='dupr'
  dupr_id?: string
  // app_skill_rating + skill_label + style_profile + breakdown come from the
  // assessment service when skill_source='assessment'. Never AI-generated.
  app_skill_rating?: number
  skill_label?: 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'expert'
  style_profile?: string
}

export interface CombinedProfile {
  profile: UserProfileRow
  skill: PlayerSkillProfileRow | null
  latest_assessment: AssessmentResultRow | null
}

export const REQUIRED_PROFILE_FIELDS = [
  'display_name',
  'visibility',
  'skill_source',
] as const

export function getMissingProfileFields(draft: ProfileDraft): string[] {
  const missing: string[] = []
  if (!draft.display_name) missing.push('display_name')
  if (!draft.visibility) missing.push('visibility')
  if (!draft.skill_source) missing.push('skill_source')
  // Skill source must come with the matching data
  if (draft.skill_source === 'manual' && draft.self_rating == null) missing.push('self_rating')
  if (draft.skill_source === 'dupr' && draft.dupr_rating == null) missing.push('dupr_rating')
  if (draft.skill_source === 'assessment' && draft.app_skill_rating == null) missing.push('app_skill_rating')
  return missing
}

export function getProfileDraftCompletionPercentage(draft: ProfileDraft): number {
  // Percentage tracks REQUIRED fields only — DOB, gender, bio, avatar, home
  // court are all optional and should never block the gauge from hitting 100%.
  // The "required rating" slot is satisfied by whichever rating source matches
  // the chosen skill_source.
  const ratingForSource =
    draft.skill_source === 'manual'
      ? draft.self_rating
      : draft.skill_source === 'dupr'
        ? draft.dupr_rating
        : draft.skill_source === 'assessment'
          ? draft.app_skill_rating
          : null
  const required = [
    draft.display_name,
    draft.visibility,
    draft.skill_source,
    ratingForSource,
  ]
  const filled = required.filter(Boolean).length
  return Math.round((filled / required.length) * 100)
}

// Soft eligibility warnings — never block save, only inform the user. UI
// renders these as gentle nudges, not errors.
export type EligibilityWarning = {
  field: string
  message: string
}

export function getEligibilityWarnings(draft: ProfileDraft): EligibilityWarning[] {
  const warnings: EligibilityWarning[] = []
  if (!draft.dob && !draft.age_band) {
    warnings.push({ field: 'dob', message: 'Add date of birth to unlock age-based events.' })
  }
  if (draft.gender === 'prefer_not_to_say' || !draft.gender) {
    warnings.push({
      field: 'gender',
      message: 'Gender-specific divisions require gender selection. You can still join open events.',
    })
  }
  if (!draft.skill_source) {
    warnings.push({ field: 'skill', message: 'Set your skill level to receive better match recommendations.' })
  }
  if (!draft.home_court_id && !draft.home_location_text) {
    warnings.push({ field: 'home_location', message: 'Add a home court so I can find nearby matches.' })
  }
  if (!draft.avatar_url) {
    warnings.push({ field: 'avatar_url', message: 'A profile photo helps other players trust your profile.' })
  }
  return warnings
}
