import { z } from 'zod'

// Lenient UUID — matches 8-4-4-4-12 hex without enforcing RFC 4122 version
// bits. Zod v4's strict z.string().uuid() rejects the demo user UUID
// (00000000-...). Mirrors the pattern hardened in event.schema.ts.
const uuidFormat = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const lenientUuid = z.string().regex(uuidFormat, 'Invalid UUID format')

// Validation for a single answer submission. Score is bounded 1..5 to match
// the seeded options. Server re-derives the score from the seed regardless,
// so this is just a sanity bound — the AI cannot inflate by sending 999.
export const AnswerSchema = z.object({
  question_id: lenientUuid,
  selected_option: z.string().min(1).max(8),
  score: z.number().int().min(1).max(5),
})

export type AnswerInput = z.infer<typeof AnswerSchema>

// A complete assessment submission must have exactly 10 answers. Caller is
// responsible for matching question_ids to the seeded set (verified in the
// service layer with DB lookup).
export const AssessmentSubmissionSchema = z.object({
  user_id: lenientUuid,
  conversation_id: lenientUuid.nullable(),
  answers: z.array(AnswerSchema).length(10, 'Assessment must have exactly 10 answers'),
})

export type AssessmentSubmissionInput = z.infer<typeof AssessmentSubmissionSchema>
