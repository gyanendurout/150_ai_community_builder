import { describe, test, expect } from 'bun:test'
import { z } from 'zod'

// Mirrors the schema in app/api/profiles/route.ts.
const CreateProfileSchema = z.object({
  approvalId: z.string().uuid(),
})

describe('POST /api/profiles schema', () => {
  test('accepts valid approvalId', () => {
    const result = CreateProfileSchema.safeParse({
      approvalId: '00000000-0000-4000-8000-000000000003',
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing approvalId', () => {
    expect(CreateProfileSchema.safeParse({}).success).toBe(false)
  })

  test('rejects non-uuid approvalId', () => {
    expect(CreateProfileSchema.safeParse({ approvalId: 'not-a-uuid' }).success).toBe(false)
  })

  test('rejects empty string approvalId', () => {
    expect(CreateProfileSchema.safeParse({ approvalId: '' }).success).toBe(false)
  })
})

// Mirrors the discriminated union in app/api/profiles/dupr-lookup/route.ts.
const DuprLookupRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('by_id'), dupr_id: z.string().min(1).max(64) }),
  z.object({ kind: z.literal('by_name'), name: z.string().min(2).max(128) }),
  z.object({ kind: z.literal('skip') }),
])

describe('POST /api/profiles/dupr-lookup schema', () => {
  test('accepts by_id lookup', () => {
    expect(
      DuprLookupRequestSchema.safeParse({ kind: 'by_id', dupr_id: 'DUPR123' }).success,
    ).toBe(true)
  })

  test('accepts by_name lookup', () => {
    expect(
      DuprLookupRequestSchema.safeParse({ kind: 'by_name', name: 'Alex' }).success,
    ).toBe(true)
  })

  test('accepts skip', () => {
    expect(DuprLookupRequestSchema.safeParse({ kind: 'skip' }).success).toBe(true)
  })

  test('rejects unknown kind', () => {
    expect(
      DuprLookupRequestSchema.safeParse({ kind: 'wildcard', dupr_id: 'X' }).success,
    ).toBe(false)
  })

  test('rejects by_name with too-short name', () => {
    expect(
      DuprLookupRequestSchema.safeParse({ kind: 'by_name', name: 'A' }).success,
    ).toBe(false)
  })

  test('rejects missing dupr_id on by_id', () => {
    expect(DuprLookupRequestSchema.safeParse({ kind: 'by_id' }).success).toBe(false)
  })
})

// Mirrors the assessment submission schema in app/api/profiles/assessment/route.ts.
const AnswerInputSchema = z.object({
  question_id: z.string().min(1),
  selected_option: z.string().min(1).max(8),
  score: z.number().int().min(1).max(5),
})

const AssessmentRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  answers: z.array(AnswerInputSchema).length(10),
})

function tenAnswers(): Array<{ question_id: string; selected_option: string; score: number }> {
  return Array.from({ length: 10 }, (_, i) => ({
    question_id: `q-${i + 1}`,
    selected_option: 'a',
    score: 3,
  }))
}

describe('POST /api/profiles/assessment schema', () => {
  test('accepts 10 valid answers', () => {
    expect(
      AssessmentRequestSchema.safeParse({ answers: tenAnswers() }).success,
    ).toBe(true)
  })

  test('rejects fewer than 10 answers', () => {
    expect(
      AssessmentRequestSchema.safeParse({ answers: tenAnswers().slice(0, 9) }).success,
    ).toBe(false)
  })

  test('rejects more than 10 answers', () => {
    expect(
      AssessmentRequestSchema.safeParse({
        answers: [...tenAnswers(), { question_id: 'extra', selected_option: 'a', score: 3 }],
      }).success,
    ).toBe(false)
  })

  test('rejects score above 5', () => {
    const answers = tenAnswers()
    answers[0].score = 6
    expect(AssessmentRequestSchema.safeParse({ answers }).success).toBe(false)
  })

  test('rejects score below 1', () => {
    const answers = tenAnswers()
    answers[0].score = 0
    expect(AssessmentRequestSchema.safeParse({ answers }).success).toBe(false)
  })

  test('accepts null conversationId', () => {
    expect(
      AssessmentRequestSchema.safeParse({
        conversationId: null,
        answers: tenAnswers(),
      }).success,
    ).toBe(true)
  })

  test('accepts valid conversationId', () => {
    expect(
      AssessmentRequestSchema.safeParse({
        conversationId: '00000000-0000-4000-8000-000000000004',
        answers: tenAnswers(),
      }).success,
    ).toBe(true)
  })

  test('rejects invalid conversationId', () => {
    expect(
      AssessmentRequestSchema.safeParse({
        conversationId: 'bad-uuid',
        answers: tenAnswers(),
      }).success,
    ).toBe(false)
  })
})
