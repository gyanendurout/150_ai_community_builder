import type { AssessmentQuestionRow } from '@/lib/supabase/types'

export type AssessmentCategory =
  | 'serve' | 'return' | 'dinking' | 'volley' | 'positioning'
  | 'teamwork' | 'shot_selection' | 'movement'
  | 'match_experience' | 'competitive_comfort'

export const ASSESSMENT_CATEGORIES: AssessmentCategory[] = [
  'serve', 'return', 'dinking', 'volley', 'positioning',
  'teamwork', 'shot_selection', 'movement',
  'match_experience', 'competitive_comfort',
]

export type SkillLabel = 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'expert'

// Style profiles are deterministic labels, NOT AI inventions.
// The set is closed — the scoring service picks exactly one per assessment.
export type StyleProfile =
  | 'social_doubles_player'
  | 'control_focused_player'
  | 'aggressive_net_player'
  | 'competitive_all_rounder'
  | 'beginner_friendly_learner'
  | 'developing_player'

export type QuestionOption = {
  value: string  // 'a' | 'b' | ... matches the seeded options
  label: string
  score: number  // 1..5
}

export type AssessmentQuestion = {
  id: string
  question_key: string
  question_text: string
  category: AssessmentCategory
  sort_order: number
  options: QuestionOption[]
}

export type AssessmentAnswer = {
  question_id: string
  question_key: string
  category: AssessmentCategory
  selected_option: string
  score: number  // 1..5, validated against the option's declared score
}

export type CategoryBreakdown = Record<AssessmentCategory, number>

export type AssessmentResult = {
  total_score: number       // 10..50
  app_skill_rating: number  // 1.0..5.0, one decimal
  skill_label: SkillLabel
  style_profile: StyleProfile
  category_breakdown: CategoryBreakdown
  confidence_score: number  // 0.0..1.0
}

// Helper to parse seeded options_json into typed options.
export function parseAssessmentQuestion(row: AssessmentQuestionRow): AssessmentQuestion {
  const raw = Array.isArray(row.options_json) ? row.options_json : []
  const options: QuestionOption[] = raw.map((entry) => {
    const o = entry as { value?: unknown; label?: unknown; score?: unknown }
    return {
      value: String(o.value ?? ''),
      label: String(o.label ?? ''),
      score: typeof o.score === 'number' ? o.score : 0,
    }
  })
  return {
    id: row.id,
    question_key: row.question_key,
    question_text: row.question_text,
    category: row.category,
    sort_order: row.sort_order,
    options,
  }
}
