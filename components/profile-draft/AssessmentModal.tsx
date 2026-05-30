'use client'
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Question shape matches features/profile-assessment/assessment.types.ts AssessmentQuestion.
// Re-declared here so the component is self-contained and not coupled to server-only modules.
export interface AssessmentQuestion {
  id: string
  question_key: string
  question_text: string
  category: string
  sort_order: number
  options: Array<{ value: string; label: string; score: number }>
}

export interface AssessmentAnswer {
  question_id: string
  selected_option: string
  score: number
}

export interface AssessmentResult {
  total_score: number
  app_skill_rating: number
  skill_label: string
  style_profile: string
  category_breakdown: Record<string, number>
  confidence_score: number
}

export interface AssessmentModalProps {
  conversationId: string | null
  open: boolean
  onClose: () => void
  onComplete: (result: AssessmentResult) => void
}

interface AssessmentApiListResponse {
  questions: AssessmentQuestion[]
}

interface AssessmentApiSubmitResponse {
  result: AssessmentResult
}

export function AssessmentModal({ conversationId, open, onClose, onComplete }: AssessmentModalProps) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({})

  // Fetch questions when the modal opens. Reset transient state each open.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setCurrentIdx(0)
    setAnswers({})
    fetch('/api/profiles/assessment')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Failed to load questions'))))
      .then((data: AssessmentApiListResponse) => {
        if (cancelled) return
        setQuestions(data.questions ?? [])
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load questions')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const currentQ = questions[currentIdx]
  const totalQs = questions.length
  const answerCount = Object.keys(answers).length
  const isLastQuestion = currentIdx === totalQs - 1
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined

  const handleSelect = (option: { value: string; score: number }) => {
    if (!currentQ) return
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        question_id: currentQ.id,
        selected_option: option.value,
        score: option.score,
      },
    }))
  }

  const handleNext = () => {
    if (!isLastQuestion) {
      setCurrentIdx(i => i + 1)
    }
  }

  const handleBack = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1)
  }

  const handleSubmit = async () => {
    if (answerCount !== totalQs || totalQs === 0) return
    setSubmitting(true)
    setError(null)
    try {
      // Server validates against seeded questions and recomputes the score.
      // We send our local score as a sanity bound but the server is authoritative.
      const res = await fetch('/api/profiles/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          answers: questions.map(q => ({
            question_id: q.id,
            selected_option: answers[q.id].selected_option,
            score: answers[q.id].score,
          })),
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error((data.error as string | undefined) ?? 'Failed to submit assessment')
      }
      const data = (await res.json()) as AssessmentApiSubmitResponse
      onComplete(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Skill assessment"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Pickleball Skill Check</h2>
            <p className="text-xs text-muted">
              {totalQs > 0 ? `Question ${currentIdx + 1} of ${totalQs}` : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-soft"
            aria-label="Close assessment"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && currentQ && (
            <>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary">
                {currentQ.category.replace(/_/g, ' ')}
              </p>
              <h3 className="mb-4 text-lg font-medium text-ink">{currentQ.question_text}</h3>
              <div className="space-y-2">
                {currentQ.options.map(opt => {
                  const selected = currentAnswer?.selected_option === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={cn(
                        'block w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-ink ring-1 ring-primary'
                          : 'border-border bg-white text-ink hover:border-primary/40',
                      )}
                      aria-pressed={selected}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-soft px-5 py-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIdx === 0 || submitting}
            className={cn(
              'rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted',
              'hover:bg-white disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Back
          </button>

          <p className="text-xs text-muted">
            {answerCount} / {totalQs} answered
          </p>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={answerCount !== totalQs || submitting}
              className={cn(
                'rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white',
                'hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scoring…
                </span>
              ) : (
                'Submit Assessment'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!currentAnswer}
              className={cn(
                'rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white',
                'hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              Next
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
