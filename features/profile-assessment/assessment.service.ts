import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import { AssessmentRepository } from './assessment.repository'
import {
  ASSESSMENT_CATEGORIES,
  parseAssessmentQuestion,
  type AssessmentAnswer,
  type AssessmentCategory,
  type AssessmentQuestion,
  type AssessmentResult,
  type CategoryBreakdown,
  type SkillLabel,
  type StyleProfile,
} from './assessment.types'
import {
  AssessmentSubmissionSchema,
  type AssessmentSubmissionInput,
} from './assessment.schema'
import type { Json } from '@/lib/supabase/types'

// ============================================================================
// PURE DETERMINISTIC SCORING
// ----------------------------------------------------------------------------
// These functions are exported so unit tests can verify them WITHOUT a DB.
// They never depend on the AI — same input always returns the same output.
// ============================================================================

// total_score / 10  → app_skill_rating (rounded to 1 decimal). 10 questions
// each scored 1..5 → total 10..50 → rating 1.0..5.0.
export function computeAppSkillRating(answers: AssessmentAnswer[]): number {
  if (answers.length === 0) return 1.0
  const total = answers.reduce((sum, a) => sum + a.score, 0)
  const rating = total / answers.length
  return Math.round(rating * 10) / 10
}

// Five bins. Boundaries chosen so a "borderline" answer set (e.g. all 3s)
// lands cleanly in `intermediate`, and a single 5 doesn't push from
// `intermediate` to `expert`.
export function computeSkillLabel(appSkillRating: number): SkillLabel {
  if (appSkillRating < 2.0) return 'beginner'
  if (appSkillRating < 3.0) return 'developing'
  if (appSkillRating < 3.7) return 'intermediate'
  if (appSkillRating < 4.5) return 'advanced'
  return 'expert'
}

// One score per category (10 categories, 10 questions). Future-proofed for
// multiple questions per category by averaging.
export function computeCategoryBreakdown(answers: AssessmentAnswer[]): CategoryBreakdown {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const a of answers) {
    sums[a.category] = (sums[a.category] ?? 0) + a.score
    counts[a.category] = (counts[a.category] ?? 0) + 1
  }
  const breakdown = {} as CategoryBreakdown
  for (const cat of ASSESSMENT_CATEGORIES) {
    const n = counts[cat] ?? 0
    breakdown[cat] = n > 0 ? Math.round((sums[cat] / n) * 10) / 10 : 0
  }
  return breakdown
}

// Deterministic style classification. Rules are checked in order — first
// match wins, so more specific patterns must come first. Default catches
// any non-matching mid-range player.
export function computeStyleProfile(
  breakdown: CategoryBreakdown,
  appSkillRating: number
): StyleProfile {
  const aggressive = breakdown.volley >= 4 && breakdown.competitive_comfort >= 4
  if (aggressive) return 'aggressive_net_player'

  const controlled =
    breakdown.dinking >= 4 && breakdown.positioning >= 4 && breakdown.volley <= 3
  if (controlled) return 'control_focused_player'

  const social = breakdown.teamwork >= 4 && breakdown.competitive_comfort <= 3
  if (social) return 'social_doubles_player'

  const allRounder =
    breakdown.match_experience >= 4 &&
    ASSESSMENT_CATEGORIES.every(cat => breakdown[cat] >= 3)
  if (allRounder) return 'competitive_all_rounder'

  const beginnerLike = breakdown.match_experience <= 2 || appSkillRating < 2.5
  if (beginnerLike) return 'beginner_friendly_learner'

  return 'developing_player'
}

// Confidence drops as answer variance rises. A user answering 1,1,5,5,1,5,...
// shows internal inconsistency → less confident result. Clamped [0.3, 1.0]
// so we never declare a rating worthless.
export function computeConfidenceScore(answers: AssessmentAnswer[]): number {
  if (answers.length === 0) return 0.3
  const mean = answers.reduce((s, a) => s + a.score, 0) / answers.length
  const variance =
    answers.reduce((s, a) => s + (a.score - mean) ** 2, 0) / answers.length
  // Variance of 4 (max practical) → confidence 0; variance 0 → confidence 1.
  const raw = 1 - variance / 4
  const clamped = Math.max(0.3, Math.min(1.0, raw))
  return Math.round(clamped * 100) / 100
}

// Single entrypoint: hand it the 10 answers, get back the full result.
// Used by the service AND by tests directly.
export function scoreAssessment(answers: AssessmentAnswer[]): AssessmentResult {
  const total_score = answers.reduce((s, a) => s + a.score, 0)
  const app_skill_rating = computeAppSkillRating(answers)
  const skill_label = computeSkillLabel(app_skill_rating)
  const category_breakdown = computeCategoryBreakdown(answers)
  const style_profile = computeStyleProfile(category_breakdown, app_skill_rating)
  const confidence_score = computeConfidenceScore(answers)
  return {
    total_score,
    app_skill_rating,
    skill_label,
    category_breakdown,
    style_profile,
    confidence_score,
  }
}

// ============================================================================
// SERVICE — DB-backed orchestration around the pure scoring functions
// ============================================================================

export class AssessmentService {
  constructor(private readonly repo: AssessmentRepository = new AssessmentRepository()) {}

  async listQuestions(): Promise<Result<AssessmentQuestion[]>> {
    try {
      const rows = await this.repo.listActiveQuestions()
      return ok(rows.map(parseAssessmentQuestion))
    } catch (e) {
      logger.error('AssessmentService.listQuestions failed', { error: String(e) })
      return err('Failed to load assessment questions', 'ASSESSMENT_LOAD_FAILED', 500)
    }
  }

  // Validates the submission against the seeded question bank, then persists
  // each response and the final result. Returns the deterministic result.
  async submit(input: AssessmentSubmissionInput): Promise<Result<AssessmentResult>> {
    const parsed = AssessmentSubmissionSchema.safeParse(input)
    if (!parsed.success) {
      logger.warn('AssessmentService.submit validation failed', {
        issues: parsed.error.issues.map(i => ({ path: i.path, msg: i.message })),
      })
      return err('Invalid assessment submission', 'ASSESSMENT_INVALID', 400)
    }

    try {
      const { user_id, conversation_id, answers } = parsed.data

      // Confirm every question_id maps to a real seeded question, so the AI
      // can't conjure a fake question and inject a synthetic score.
      const questionIds = answers.map(a => a.question_id)
      const questions = await this.repo.findQuestionsByIds(questionIds)
      if (questions.length !== answers.length) {
        return err(
          'One or more questions in the submission are unknown',
          'ASSESSMENT_UNKNOWN_QUESTION',
          400,
        )
      }

      // Cross-check each submitted score against the option's declared score
      // in the seed. If they disagree, trust the seed and recompute — the
      // client cannot inflate a score by sending a higher value.
      const byId = new Map(questions.map(q => [q.id, parseAssessmentQuestion(q)]))
      const verifiedAnswers: AssessmentAnswer[] = []
      for (const a of answers) {
        const q = byId.get(a.question_id)
        if (!q) {
          return err('Question lookup mismatch', 'ASSESSMENT_LOOKUP_FAILED', 500)
        }
        const matched = q.options.find(o => o.value === a.selected_option)
        if (!matched) {
          return err(
            `Option "${a.selected_option}" is not valid for question ${q.question_key}`,
            'ASSESSMENT_BAD_OPTION',
            400,
          )
        }
        verifiedAnswers.push({
          question_id: q.id,
          question_key: q.question_key,
          category: q.category,
          selected_option: matched.value,
          score: matched.score, // SERVER-SIDE — never trust client's score
        })
      }

      // Persist responses (best-effort — partial failure is OK, but the
      // result row is the source of truth and is written below).
      for (const a of verifiedAnswers) {
        try {
          await this.repo.upsertResponse({
            user_id,
            conversation_id,
            question_id: a.question_id,
            selected_option: a.selected_option,
            score: a.score,
          })
        } catch (e) {
          logger.warn('AssessmentService.upsertResponse failed', {
            user_id,
            question_id: a.question_id,
            error: String(e),
          })
        }
      }

      // Deterministic scoring — same answers always produce the same result.
      const result = scoreAssessment(verifiedAnswers)

      await this.repo.insertResult({
        user_id,
        conversation_id,
        total_score: result.total_score,
        app_skill_rating: result.app_skill_rating,
        skill_label: result.skill_label,
        category_breakdown_json: result.category_breakdown as unknown as Json,
        style_profile: result.style_profile,
        confidence_score: result.confidence_score,
      })

      logger.info('AssessmentService.submit completed', {
        user_id,
        app_skill_rating: result.app_skill_rating,
        skill_label: result.skill_label,
        style_profile: result.style_profile,
      })

      return ok(result)
    } catch (e) {
      logger.error('AssessmentService.submit failed', { error: String(e) })
      return err('Failed to score assessment', 'ASSESSMENT_SCORE_FAILED', 500)
    }
  }
}
