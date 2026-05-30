import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { DEMO_USER_ID } from '@/lib/constants'
import { AssessmentService } from '@/features/profile-assessment/assessment.service'

export const runtime = 'nodejs'

const AnswerInputSchema = z.object({
  question_id: z.string().min(1),
  selected_option: z.string().min(1).max(8),
  score: z.number().int().min(1).max(5),
})

// Body schema — note user_id is server-injected (DEMO_USER_ID for the POC),
// not accepted from the client, to prevent rating impersonation.
const AssessmentRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  answers: z.array(AnswerInputSchema).length(10, 'Assessment must have exactly 10 answers'),
})

export async function GET(): Promise<NextResponse> {
  logger.info('GET /api/profiles/assessment (list questions)')
  try {
    const service = new AssessmentService()
    const result = await service.listQuestions()
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.statusCode },
      )
    }
    return NextResponse.json({ questions: result.data })
  } catch (e) {
    logger.error('Assessment GET unexpected error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  logger.info('POST /api/profiles/assessment (submit)')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AssessmentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const service = new AssessmentService()
    const result = await service.submit({
      user_id: DEMO_USER_ID,
      conversation_id: parsed.data.conversationId ?? null,
      answers: parsed.data.answers,
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.statusCode },
      )
    }

    logger.info('Assessment submitted', {
      app_skill_rating: result.data.app_skill_rating,
      skill_label: result.data.skill_label,
      style_profile: result.data.style_profile,
    })
    return NextResponse.json({ result: result.data })
  } catch (e) {
    logger.error('Assessment POST unexpected error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
