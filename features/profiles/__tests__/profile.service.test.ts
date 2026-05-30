import { describe, test, expect, mock } from 'bun:test'
import { ProfileService, buildProfileInsert, buildSkillInsert } from '../profile.service'
import {
  getMissingProfileFields,
  getProfileDraftCompletionPercentage,
  getEligibilityWarnings,
  type ProfileDraft,
} from '../profile.types'
import type { ProfileRepository } from '../profile.repository'
import type { AssessmentRepository } from '@/features/profile-assessment/assessment.repository'

const DEMO_USER = '00000000-0000-0000-0000-000000000001'

const COMPLETE_DRAFT: ProfileDraft = {
  display_name: 'Test Player',
  visibility: 'public',
  skill_source: 'manual',
  self_rating: 3.5,
  skill_label: 'intermediate',
  home_court_id: '00000000-0000-0000-0000-000000000101',
}

// ─── getMissingProfileFields ────────────────────────────────────────────────
describe('getMissingProfileFields', () => {
  test('empty draft → required fields missing (location is optional)', () => {
    const missing = getMissingProfileFields({})
    expect(missing).toContain('display_name')
    expect(missing).toContain('visibility')
    expect(missing).toContain('skill_source')
    expect(missing).not.toContain('home_location')
  })

  test('complete draft (manual rating) → 0 missing', () => {
    expect(getMissingProfileFields(COMPLETE_DRAFT)).toEqual([])
  })

  test('skill_source=dupr without dupr_rating → flags dupr_rating', () => {
    const draft: ProfileDraft = { ...COMPLETE_DRAFT, skill_source: 'dupr', self_rating: undefined }
    expect(getMissingProfileFields(draft)).toContain('dupr_rating')
  })

  test('skill_source=assessment without app_skill_rating → flags it', () => {
    const draft: ProfileDraft = { ...COMPLETE_DRAFT, skill_source: 'assessment', self_rating: undefined }
    expect(getMissingProfileFields(draft)).toContain('app_skill_rating')
  })

  test('draft without any home location still passes (location is optional)', () => {
    const draft: ProfileDraft = { ...COMPLETE_DRAFT, home_court_id: undefined, home_location_text: undefined }
    expect(getMissingProfileFields(draft)).not.toContain('home_location')
  })
})

// ─── getProfileDraftCompletionPercentage ────────────────────────────────────
describe('getProfileDraftCompletionPercentage', () => {
  test('empty draft → 0%', () => {
    expect(getProfileDraftCompletionPercentage({})).toBe(0)
  })
  test('complete minimum → at least 56% (5 of 9 tracked filled)', () => {
    expect(getProfileDraftCompletionPercentage(COMPLETE_DRAFT)).toBeGreaterThanOrEqual(50)
  })
  test('fully filled (all optional too) → 100%', () => {
    const fully: ProfileDraft = {
      ...COMPLETE_DRAFT,
      dob: '1990-01-01',
      gender: 'male',
      bio: 'I play pickleball every Saturday.',
      avatar_url: 'https://example.com/me.png',
    }
    expect(getProfileDraftCompletionPercentage(fully)).toBe(100)
  })
})

// ─── getEligibilityWarnings (helpful microcopy, never blocks) ───────────────
describe('getEligibilityWarnings', () => {
  test('no DOB and no age_band → DOB warning', () => {
    const warnings = getEligibilityWarnings({})
    expect(warnings.some(w => w.field === 'dob')).toBe(true)
  })

  test('age_band alone is enough — no DOB warning', () => {
    const warnings = getEligibilityWarnings({ age_band: '30_39' })
    expect(warnings.some(w => w.field === 'dob')).toBe(false)
  })

  test('gender=prefer_not_to_say still surfaces gender-division warning', () => {
    const warnings = getEligibilityWarnings({ gender: 'prefer_not_to_say' })
    expect(warnings.some(w => w.field === 'gender')).toBe(true)
  })

  test('gender=female suppresses the gender warning', () => {
    const warnings = getEligibilityWarnings({ gender: 'female' })
    expect(warnings.some(w => w.field === 'gender')).toBe(false)
  })

  test('no skill source → skill warning', () => {
    const warnings = getEligibilityWarnings({})
    expect(warnings.some(w => w.field === 'skill')).toBe(true)
  })
})

// ─── buildProfileInsert / buildSkillInsert ──────────────────────────────────
describe('build helpers', () => {
  test('buildProfileInsert maps skill_label to skill_level (5 bins → 4 bins)', () => {
    const profile = buildProfileInsert({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: { ...COMPLETE_DRAFT, skill_label: 'developing' },
    })
    expect(profile.skill_level).toBe('beginner') // developing collapses to beginner
  })

  test('buildProfileInsert with expert → skill_level=pro', () => {
    const profile = buildProfileInsert({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: { ...COMPLETE_DRAFT, skill_label: 'expert' },
    })
    expect(profile.skill_level).toBe('pro')
  })

  test('buildSkillInsert with skill_source=dupr persists dupr_id and dupr_status=found', () => {
    const skill = buildSkillInsert({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: { ...COMPLETE_DRAFT, skill_source: 'dupr', dupr_rating: 4.0, dupr_id: 'DUPR-DEMO-0001' },
    })
    expect(skill.skill_source).toBe('dupr')
    expect(skill.dupr_status).toBe('found')
    expect(skill.dupr_id).toBe('DUPR-DEMO-0001')
    expect(skill.dupr_rating).toBe(4.0)
    expect(skill.self_rating).toBeNull()
  })

  test('buildSkillInsert with skill_source=manual does not leak DUPR fields', () => {
    const skill = buildSkillInsert({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: { ...COMPLETE_DRAFT, skill_source: 'manual', self_rating: 3.0, dupr_id: 'STALE' },
    })
    expect(skill.skill_source).toBe('manual')
    expect(skill.self_rating).toBe(3.0)
    expect(skill.dupr_id).toBeNull()
    expect(skill.dupr_rating).toBeNull()
  })
})

// ─── ProfileService.saveFromDraft — rejects incomplete drafts ───────────────
describe('ProfileService.saveFromDraft — guardrails', () => {
  function buildMockRepo(overrides: Partial<ProfileRepository> = {}) {
    return {
      findByUserId: mock(async () => null),
      upsertProfile: mock(async () => ({ id: 'p1' } as never)),
      updateProfile: mock(async () => ({} as never)),
      findSkillByUserId: mock(async () => null),
      upsertSkill: mock(async () => ({ id: 's1' } as never)),
      updateSkill: mock(async () => ({} as never)),
      ...overrides,
    } as unknown as ProfileRepository
  }
  function buildMockAssessmentRepo(): AssessmentRepository {
    return {
      listActiveQuestions: mock(async () => []),
      findQuestionsByIds: mock(async () => []),
      upsertResponse: mock(async () => ({} as never)),
      insertResult: mock(async () => ({} as never)),
      findLatestResult: mock(async () => null),
    } as unknown as AssessmentRepository
  }

  test('rejects incomplete draft (no display_name) with 422', async () => {
    const svc = new ProfileService(buildMockRepo(), buildMockAssessmentRepo())
    const r = await svc.saveFromDraft({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: { visibility: 'public', skill_source: 'manual', self_rating: 3.0, home_court_id: '00000000-0000-0000-0000-000000000101' },
    })
    expect(r.error?.code).toBe('PROFILE_DRAFT_INCOMPLETE')
    expect(r.error?.statusCode).toBe(422)
  })

  test('valid draft → both repos called in sequence, returns combined profile', async () => {
    const upsertProfile = mock(async () => ({
      id: 'p-1',
      user_id: DEMO_USER,
      display_name: 'Test Player',
    } as never))
    const upsertSkill = mock(async () => ({
      id: 's-1',
      user_id: DEMO_USER,
      skill_source: 'manual',
    } as never))
    const svc = new ProfileService(
      buildMockRepo({ upsertProfile, upsertSkill }),
      buildMockAssessmentRepo(),
    )
    const r = await svc.saveFromDraft({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: COMPLETE_DRAFT,
    })
    expect(r.error).toBeNull()
    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(upsertSkill).toHaveBeenCalledTimes(1)
    expect(r.data?.profile.id).toBe('p-1')
    expect(r.data?.skill?.id).toBe('s-1')
  })

  test('skill save failure returns SKILL_SAVE_FAILED (profile already persisted)', async () => {
    const svc = new ProfileService(
      buildMockRepo({
        upsertSkill: mock(async () => { throw new Error('DB down') }),
      }),
      buildMockAssessmentRepo(),
    )
    const r = await svc.saveFromDraft({
      user_id: DEMO_USER,
      conversation_id: null,
      draft: COMPLETE_DRAFT,
    })
    expect(r.error?.code).toBe('SKILL_SAVE_FAILED')
  })
})

// ─── ProfileService.getById — public detail page lookup ─────────────────────
describe('ProfileService.getById', () => {
  function buildMockRepo(overrides: Partial<ProfileRepository> = {}) {
    return {
      findById: mock(async () => null),
      findByUserId: mock(async () => null),
      upsertProfile: mock(async () => ({} as never)),
      updateProfile: mock(async () => ({} as never)),
      findSkillByUserId: mock(async () => null),
      upsertSkill: mock(async () => ({} as never)),
      updateSkill: mock(async () => ({} as never)),
      ...overrides,
    } as unknown as ProfileRepository
  }
  function buildMockAssessmentRepo(latest: unknown = null): AssessmentRepository {
    return {
      listActiveQuestions: mock(async () => []),
      findQuestionsByIds: mock(async () => []),
      upsertResponse: mock(async () => ({} as never)),
      insertResult: mock(async () => ({} as never)),
      findLatestResult: mock(async () => latest),
    } as unknown as AssessmentRepository
  }

  test('returns PROFILE_NOT_FOUND with 404 when profile missing', async () => {
    const svc = new ProfileService(buildMockRepo(), buildMockAssessmentRepo())
    const r = await svc.getById('missing-id')
    expect(r.error?.code).toBe('PROFILE_NOT_FOUND')
    expect(r.error?.statusCode).toBe(404)
  })

  test('returns combined profile when found, fans out to skill + assessment', async () => {
    const profile = { id: 'p-9', user_id: DEMO_USER, display_name: 'Alex' }
    const skill = { id: 's-9', user_id: DEMO_USER, skill_source: 'manual' }
    const latest = { id: 'a-9', user_id: DEMO_USER, app_skill_rating: 3.4 }
    const findById = mock(async () => profile as never)
    const findSkill = mock(async () => skill as never)
    const svc = new ProfileService(
      buildMockRepo({ findById, findSkillByUserId: findSkill }),
      buildMockAssessmentRepo(latest),
    )
    const r = await svc.getById('p-9')
    expect(r.error).toBeNull()
    expect(r.data?.profile.id).toBe('p-9')
    expect(r.data?.skill?.id).toBe('s-9')
    expect(r.data?.latest_assessment?.id).toBe('a-9')
    expect(findById).toHaveBeenCalledTimes(1)
    expect(findSkill).toHaveBeenCalledWith(DEMO_USER)
  })

  test('returns PROFILE_FETCH_FAILED with 500 when repo throws', async () => {
    const svc = new ProfileService(
      buildMockRepo({
        findById: mock(async () => { throw new Error('DB down') }),
      }),
      buildMockAssessmentRepo(),
    )
    const r = await svc.getById('p-x')
    expect(r.error?.code).toBe('PROFILE_FETCH_FAILED')
    expect(r.error?.statusCode).toBe(500)
  })
})
