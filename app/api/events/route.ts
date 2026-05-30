import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { DEMO_USER_ID } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase/server'
import { ApprovalService } from '@/features/approvals/approval.service'
import { EventService } from '@/features/events/event.service'
import { AuditService } from '@/features/audit/audit.service'
import type { Json } from '@/lib/supabase/types'

export const runtime = 'nodejs'

// Lenient UUID: accepts any well-formed hex UUID (including zero-padded demo
// IDs) so a non-existent ID returns 404 from the DB rather than 400 here.
const lenientUuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Invalid UUID format',
  )

const CreateEventSchema = z.object({
  approvalId: lenientUuid,
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  logger.info('POST /api/events')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateEventSchema.safeParse(body)
  if (!parsed.success) {
    // 422 — well-formed JSON but a required field is missing or wrongly typed
    // (e.g. no approvalId, or approvalId is not a UUID). 400 is reserved for
    // truly malformed input (handled above when JSON.parse fails).
    return NextResponse.json(
      { error: 'Missing or invalid required fields', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const { approvalId } = parsed.data
  const userId = DEMO_USER_ID
  const supabase = createServiceClient()

  try {
    // Load approval record
    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .maybeSingle()

    if (approvalError || !approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }
    if (approval.status !== 'pending') {
      return NextResponse.json({ error: 'Approval is not pending' }, { status: 409 })
    }

    // Approve the record
    const approvalService = new ApprovalService()
    const approveResult = await approvalService.approve(approvalId)
    if (approveResult.error) {
      logger.error('Failed to approve', { error: approveResult.error.message })
      return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
    }

    // Extract draft from approval payload and merge with required event fields
    const payload = approval.action_payload_json as Record<string, unknown>
    const draftData = (payload.draft ?? {}) as Record<string, unknown>

    // Guard: ensure the draft has all required fields before proceeding
    if (!draftData.title || !draftData.start_at || !draftData.player_capacity) {
      logger.error('Approval draft is missing required fields', { approvalId, draftData })
      return NextResponse.json(
        { error: 'Event draft is incomplete — title, start_at, and player_capacity are required' },
        { status: 422 }
      )
    }

    const eventData = {
      ...draftData,
      organizer_id: userId,
      status: 'published',
      source: 'ai_chat',
    }

    // Create the event (EventService validates with EventInsertSchema internally)
    const eventService = new EventService()
    const eventResult = await eventService.createEvent(eventData)
    if (eventResult.error) {
      logger.error('Failed to create event', { error: eventResult.error.message })
      return NextResponse.json(
        { error: eventResult.error.message },
        { status: eventResult.error.statusCode }
      )
    }

    const event = eventResult.data

    // Write audit log entry
    const auditService = new AuditService()
    await auditService.log({
      actor_user_id: userId,
      action: 'event.created',
      entity_type: 'event',
      entity_id: event.id,
      before_json: null,
      after_json: event as unknown as Json,
    })

    logger.info('POST /api/events completed', { eventId: event.id })

    return NextResponse.json({ eventId: event.id })
  } catch (e) {
    logger.error('Events route unexpected error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
