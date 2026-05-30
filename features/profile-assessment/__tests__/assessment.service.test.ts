import { describe, test, expect, mock } from 'bun:test'
import {
  scoreAssessment,
  computeAppSkillRating,
  computeSkillLabel,
  computeCategoryBreakdown,
  computeStyleProfile,
  computeConfidenceScore,
  AssessmentService,
} from '../assessment.service'
import type { AssessmentRepository } from '../assessment.repository'
import { ASSESSMENT_CATEGORIES, type AssessmentAnswer, type CategoryBreakdown } from '../assessment.types'

// ─── Fixtures ───────────────────────────────────────────────────────────────

// Helper to build a 10-answer set from per-category scores. Order matches
// ASSESSMENT_CATEGORIES so the cat→score mapping is unambiguous.
function makeAnswers(scores: number[]): AssessmentAnswer[] {
  if (scores.length !== 10) throw new Error('makeAnswers needs exactly 10 scores')
  return ASSESSMENT_CATEGORIES.map((category, i) => ({
    question_id: `q-${category}`,
    question_key: `q-${category}`,
    category,
    selected_option: 'a',
    score: scores[i],
  }))
}

const ALL_ONES = makeAnswers([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
const ALL_THREES = makeAnswers([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])
const ALL_FIVES = makeAnswers([5, 5, 5, 5, 5, 5, 5, 5, 5, 5])

// ─── computeAppSkillRating ──────────────────────────────────────────────────
describe('computeAppSkillRating', () => {
  test('all 1s → 1.0', () => {
    expect(computeAppSkillRating(ALL_ONES)).toBe(1.0)
  })
  test('all 3s → 3.0', () => {
    expect(computeAppSkillRating(ALL_THREES)).toBe(3.0)
  })
  test('all 5s → 5.0', () => {
    expect(computeAppSkillRating(ALL_FIVES)).toBe(5.0)
  })
  test('mixed 30 total → 3.0', () => {
    const answers = makeAnswers([1, 2, 3, 4, 5, 1, 2, 3, 4, 5])
    expect(computeAppSkillRating(answers)).toBe(3.0)
  })
  test('total 34 / 10 → 3.4 (rounded to 1 decimal)', () => {
    const answers = makeAnswers([3, 3, 3, 4, 4, 3, 3, 4, 3, 4])
    expect(computeAppSkillRating(answers)).toBe(3.4)
  })
  test('empty input → 1.0 (lowest)', () => {
    expect(computeAppSkillRating([])).toBe(1.0)
  })
})

// ─── computeSkillLabel ──────────────────────────────────────────────────────
describe('computeSkillLabel — five bins', () => {
  test('1.0 → beginner', () => expect(computeSkillLabel(1.0)).toBe('beginner'))
  test('1.9 → beginner', () => expect(computeSkillLabel(1.9)).toBe('beginner'))
  test('2.0 → developing', () => expect(computeSkillLabel(2.0)).toBe('developing'))
  test('2.9 → developing', () => expect(computeSkillLabel(2.9)).toBe('developing'))
  test('3.0 → intermediate', () => expect(computeSkillLabel(3.0)).toBe('intermediate'))
  test('3.6 → intermediate', () => expect(computeSkillLabel(3.6)).toBe('intermediate'))
  test('3.7 → advanced', () => expect(computeSkillLabel(3.7)).toBe('advanced'))
  test('4.4 → advanced', () => expect(computeSkillLabel(4.4)).toBe('advanced'))
  test('4.5 → expert', () => expect(computeSkillLabel(4.5)).toBe('expert'))
  test('5.0 → expert', () => expect(computeSkillLabel(5.0)).toBe('expert'))
})

// ─── computeCategoryBreakdown ───────────────────────────────────────────────
describe('computeCategoryBreakdown', () => {
  test('produces one entry per category', () => {
    const breakdown = computeCategoryBreakdown(ALL_THREES)
    for (const cat of ASSESSMENT_CATEGORIES) {
      expect(breakdown[cat]).toBe(3)
    }
  })
  test('per-category scores preserved', () => {
    const breakdown = computeCategoryBreakdown(
      makeAnswers([1, 2, 3, 4, 5, 1, 2, 3, 4, 5])
    )
    expect(breakdown.serve).toBe(1)
    expect(breakdown.return).toBe(2)
    expect(breakdown.dinking).toBe(3)
    expect(breakdown.volley).toBe(4)
    expect(breakdown.positioning).toBe(5)
    expect(breakdown.competitive_comfort).toBe(5)
  })
})

// ─── computeStyleProfile (deterministic rules) ──────────────────────────────
describe('computeStyleProfile — first-match-wins rule chain', () => {
  function bd(over: Partial<CategoryBreakdown>): CategoryBreakdown {
    const base = Object.fromEntries(ASSESSMENT_CATEGORIES.map(c => [c, 3])) as CategoryBreakdown
    return { ...base, ...over }
  }
  test('aggressive_net: volley≥4 AND competitive≥4', () => {
    expect(computeStyleProfile(bd({ volley: 5, competitive_comfort: 5 }), 4.0)).toBe('aggressive_net_player')
  })
  test('control_focused: dinking≥4 AND positioning≥4 AND volley≤3', () => {
    expect(computeStyleProfile(bd({ dinking: 5, positioning: 5, volley: 2 }), 3.5)).toBe('control_focused_player')
  })
  test('social: teamwork≥4 AND competitive≤3', () => {
    expect(computeStyleProfile(bd({ teamwork: 5, competitive_comfort: 2 }), 3.0)).toBe('social_doubles_player')
  })
  test('all-rounder: match_experience≥4 AND all categories ≥3', () => {
    expect(computeStyleProfile(bd({ match_experience: 5 }), 4.0)).toBe('competitive_all_rounder')
  })
  test('beginner-friendly when match_experience ≤ 2', () => {
    expect(computeStyleProfile(bd({ match_experience: 1 }), 2.0)).toBe('beginner_friendly_learner')
  })
  test('beginner-friendly when rating < 2.5', () => {
    expect(computeStyleProfile(bd({}), 2.0)).toBe('beginner_friendly_learner')
  })
  test('developing_player is the catch-all default', () => {
    expect(computeStyleProfile(bd({}), 3.0)).toBe('developing_player')
  })
})

// ─── computeConfidenceScore ─────────────────────────────────────────────────
describe('computeConfidenceScore', () => {
  test('all same score → max confidence 1.0', () => {
    expect(computeConfidenceScore(ALL_THREES)).toBe(1.0)
  })
  test('high-variance answers → lower confidence', () => {
    const mixed = makeAnswers([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])
    const score = computeConfidenceScore(mixed)
    expect(score).toBeLessThan(0.5)
    expect(score).toBeGreaterThanOrEqual(0.3) // clamped
  })
  test('never drops below 0.3', () => {
    const extreme = makeAnswers([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])
    expect(computeConfidenceScore(extreme)).toBeGreaterThanOrEqual(0.3)
  })
  test('empty input → 0.3 (floor)', () => {
    expect(computeConfidenceScore([])).toBe(0.3)
  })
})

// ─── scoreAssessment — same input always produces same output ───────────────
describe('scoreAssessment — deterministic', () => {
  test('produces identical result for identical input across runs', () => {
    const answers = makeAnswers([3, 3, 4, 3, 4, 3, 4, 3, 3, 4])
    const r1 = scoreAssessment(answers)
    const r2 = scoreAssessment(answers)
    expect(r1).toEqual(r2)
  })
  test('full result for an "intermediate" player profile', () => {
    const answers = makeAnswers([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])
    const r = scoreAssessment(answers)
    expect(r.total_score).toBe(30)
    expect(r.app_skill_rating).toBe(3.0)
    expect(r.skill_label).toBe('intermediate')
    expect(r.confidence_score).toBe(1.0)
  })
  test('full result for an "expert all-rounder" profile', () => {
    const answers = makeAnswers([5, 5, 4, 4, 5, 4, 5, 5, 5, 4])
    const r = scoreAssessment(answers)
    expect(r.app_skill_rating).toBeGreaterThanOrEqual(4.5)
    expect(r.skill_label).toBe('expert')
  })
})

// ─── AssessmentService.submit — server rejects unknown questions & options ──
describe('AssessmentService.submit — security guards', () => {
  const buildRepo = (overrides: Partial<AssessmentRepository> = {}) => ({
    listActiveQuestions: mock(async () => []),
    findQuestionsByIds: mock(async () => []),
    upsertResponse: mock(async () => ({} as never)),
    insertResult: mock(async () => ({} as never)),
    findLatestResult: mock(async () => null),
    ...overrides,
  })

  test('rejects submission with wrong answer count', async () => {
    const svc = new AssessmentService(buildRepo() as unknown as AssessmentRepository)
    const r = await svc.submit({
      user_id: '00000000-0000-0000-0000-000000000001',
      conversation_id: null,
      answers: [],
    })
    expect(r.error?.code).toBe('ASSESSMENT_INVALID')
  })

  test('rejects when a question_id is not in the seeded bank', async () => {
    const svc = new AssessmentService(buildRepo({
      findQuestionsByIds: mock(async () => []), // DB returns nothing
    }) as unknown as AssessmentRepository)
    const r = await svc.submit({
      user_id: '00000000-0000-0000-0000-000000000001',
      conversation_id: null,
      answers: Array.from({ length: 10 }, (_, i) => ({
        question_id: `11111111-1111-4111-8111-11111111111${i}`,
        selected_option: 'a',
        score: 3,
      })),
    })
    expect(r.error?.code).toBe('ASSESSMENT_UNKNOWN_QUESTION')
  })
})
