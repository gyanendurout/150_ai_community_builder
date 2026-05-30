import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import { ProfileRepository } from './profile.repository'
import { AssessmentRepository } from '@/features/profile-assessment/assessment.repository'
import {
  UserProfileInsertSchema,
  PlayerSkillProfileInsertSchema,
  type UserProfileInsertInput,
  type PlayerSkillProfileInsertInput,
} from './profile.schema'
import {
  getProfileDraftCompletionPercentage,
  getMissingProfileFields,
  type CombinedProfile,
  type ProfileDraft,
} from './profile.types'
import type {
  UserProfileRow,
  PlayerSkillProfileRow,
} from '@/lib/supabase/types'

// Input to ProfileService.saveFromDraft — what the approval payload should
// contain after the user clicks Approve & Save Profile.
export interface SaveProfileInput {
  user_id: string
  conversation_id: string | null
  draft: ProfileDraft
}

export class ProfileService {
  constructor(
    private readonly repo: ProfileRepository = new ProfileRepository(),
    private readonly assessmentRepo: AssessmentRepository = new AssessmentRepository(),
  ) {}

  async listProfiles(): Promise<Result<UserProfileRow[]>> {
    try {
      const rows = await this.repo.findAll()
      return ok(rows)
    } catch (e) {
      logger.error('ProfileService.listProfiles failed', { error: String(e) })
      return err('Failed to list profiles', 'PROFILE_LIST_FAILED', 500)
    }
  }

  async getCombined(userId: string): Promise<Result<CombinedProfile>> {
    try {
      const [profile, skill, latestAssessment] = await Promise.all([
        this.repo.findByUserId(userId),
        this.repo.findSkillByUserId(userId),
        this.assessmentRepo.findLatestResult(userId),
      ])
      if (!profile) return err('Profile not found', 'PROFILE_NOT_FOUND', 404)
      return ok({ profile, skill, latest_assessment: latestAssessment })
    } catch (e) {
      logger.error('ProfileService.getCombined failed', { userId, error: String(e) })
      return err('Failed to fetch profile', 'PROFILE_FETCH_FAILED', 500)
    }
  }

  // Used by the public profile detail page — looks up by the user_profiles
  // primary key (not user_id) and fans out to skill + latest assessment.
  async getById(profileId: string): Promise<Result<CombinedProfile>> {
    try {
      const profile = await this.repo.findById(profileId)
      if (!profile) return err('Profile not found', 'PROFILE_NOT_FOUND', 404)
      const [skill, latestAssessment] = await Promise.all([
        this.repo.findSkillByUserId(profile.user_id),
        this.assessmentRepo.findLatestResult(profile.user_id),
      ])
      return ok({ profile, skill, latest_assessment: latestAssessment })
    } catch (e) {
      logger.error('ProfileService.getById failed', { profileId, error: String(e) })
      return err('Failed to fetch profile', 'PROFILE_FETCH_FAILED', 500)
    }
  }

  // The single happy-path that the POST /api/profiles route calls AFTER an
  // approved approval row has been verified. Persists user_profile +
  // player_skill_profile and returns both.
  async saveFromDraft(input: SaveProfileInput): Promise<Result<CombinedProfile>> {
    logger.info('ProfileService.saveFromDraft start', { user_id: input.user_id })

    const missing = getMissingProfileFields(input.draft)
    if (missing.length > 0) {
      logger.warn('ProfileService.saveFromDraft missing fields', { missing })
      return err(
        `Profile draft is incomplete — missing: ${missing.join(', ')}`,
        'PROFILE_DRAFT_INCOMPLETE',
        422,
      )
    }

    const profilePayload = buildProfileInsert(input)
    const profileParsed = UserProfileInsertSchema.safeParse(profilePayload)
    if (!profileParsed.success) {
      logger.warn('ProfileService.saveFromDraft profile validation failed', {
        issues: profileParsed.error.issues.map(i => ({ path: i.path, msg: i.message })),
      })
      return err('Invalid profile data', 'PROFILE_VALIDATION_FAILED', 400)
    }

    const skillPayload = buildSkillInsert(input)
    const skillParsed = PlayerSkillProfileInsertSchema.safeParse(skillPayload)
    if (!skillParsed.success) {
      logger.warn('ProfileService.saveFromDraft skill validation failed', {
        issues: skillParsed.error.issues.map(i => ({ path: i.path, msg: i.message })),
      })
      return err('Invalid skill data', 'SKILL_VALIDATION_FAILED', 400)
    }

    let savedProfile: UserProfileRow
    let savedSkill: PlayerSkillProfileRow
    try {
      savedProfile = await this.repo.upsertProfile(profileParsed.data)
    } catch (e) {
      logger.error('ProfileService.saveFromDraft upsertProfile failed', { error: String(e) })
      return err('Failed to save profile', 'PROFILE_SAVE_FAILED', 500)
    }

    try {
      savedSkill = await this.repo.upsertSkill(skillParsed.data)
    } catch (e) {
      logger.error('ProfileService.saveFromDraft upsertSkill failed', { error: String(e) })
      // Profile already saved — return partial success rather than fail hard.
      // The detail page renders skill as optional and the user can retry skill.
      return err('Profile saved but skill could not be persisted', 'SKILL_SAVE_FAILED', 500)
    }

    logger.info('ProfileService.saveFromDraft succeeded', {
      profile_id: savedProfile.id,
      skill_id: savedSkill.id,
    })

    return ok({
      profile: savedProfile,
      skill: savedSkill,
      latest_assessment: null, // caller fetches separately if needed
    })
  }
}

// ─── Pure builders (exported for testability) ────────────────────────────

export function buildProfileInsert(input: SaveProfileInput): UserProfileInsertInput {
  const d = input.draft
  return {
    user_id: input.user_id,
    display_name: d.display_name ?? '',
    avatar_url: d.avatar_url ?? null,
    dob: d.dob ?? null,
    age_band: d.age_band ?? null,
    gender: d.gender ?? null,
    home_court_id: d.home_court_id ?? null,
    home_location_text: d.home_location_text ?? null,
    home_latitude: d.home_latitude ?? null,
    home_longitude: d.home_longitude ?? null,
    bio: d.bio ?? null,
    visibility: d.visibility ?? 'public',
    status: 'active',
    source: 'ai_chat',
    created_from_conversation_id: input.conversation_id,
    // Mirror skill summary fields onto user_profiles for fast list/card display.
    // Fallback to a rating-derived level for manual source when no label was set.
    skill_level:
      mapSkillLabelToLevel(d.skill_label) ??
      (d.skill_source === 'manual' && d.self_rating != null
        ? mapSelfRatingToLevel(d.self_rating)
        : null),
    dupr_rating: d.skill_source === 'dupr' ? (d.dupr_rating ?? null) : null,
    app_skill_rating: d.skill_source === 'assessment' ? (d.app_skill_rating ?? null) : null,
    play_style: d.style_profile ?? null,
    profile_completion_percentage: getProfileDraftCompletionPercentage(d),
  }
}

export function buildSkillInsert(input: SaveProfileInput): PlayerSkillProfileInsertInput {
  const d = input.draft
  const isAssessment = d.skill_source === 'assessment'
  return {
    user_id: input.user_id,
    self_rating: d.skill_source === 'manual' ? (d.self_rating ?? null) : null,
    dupr_rating: d.skill_source === 'dupr' ? (d.dupr_rating ?? null) : null,
    dupr_id: d.skill_source === 'dupr' ? (d.dupr_id ?? null) : null,
    dupr_status: d.skill_source === 'dupr' ? 'found' : (d.skill_source === 'assessment' ? 'skipped' : 'not_checked'),
    app_skill_rating: isAssessment ? (d.app_skill_rating ?? null) : null,
    skill_label: d.skill_label ?? null,
    skill_source: d.skill_source ?? 'manual',
    style_profile: d.style_profile ?? null,
    confidence_score: isAssessment ? 0.9 : null,
    category_breakdown_json: null,
    last_assessed_at: isAssessment ? new Date().toISOString() : null,
  }
}

// Map the assessment's 5-bin skill_label down to the older 4-bin skill_level
// column on user_profiles so legacy event_creation memory still works.
function mapSkillLabelToLevel(
  label: ProfileDraft['skill_label']
): 'beginner' | 'intermediate' | 'advanced' | 'pro' | null {
  if (!label) return null
  if (label === 'beginner' || label === 'developing') return 'beginner'
  if (label === 'intermediate') return 'intermediate'
  if (label === 'advanced') return 'advanced'
  if (label === 'expert') return 'pro'
  return null
}

// Derive skill_level from a 1–5 self_rating when no skill_label was set
// (manual source without an assessment label).
function mapSelfRatingToLevel(
  rating: number
): 'beginner' | 'intermediate' | 'advanced' | 'pro' {
  if (rating < 2.5) return 'beginner'
  if (rating < 3.5) return 'intermediate'
  if (rating < 4.5) return 'advanced'
  return 'pro'
}
