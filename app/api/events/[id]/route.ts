import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { createServiceClient } from '@/lib/supabase/server'
import { EventService } from '@/features/events/event.service'

export const runtime = 'nodejs'

// Lenient UUID: same shape as POST /api/events so a malformed id reports 422
// (semantic error) rather than slipping through to a 500 inside Supabase.
const lenientUuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Invalid UUID format',
  )

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  logger.info('GET /api/events/[id]', { id })

  const parsed = lenientUuid.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid event id format' },
      { status: 422 },
    )
  }

  const service = new EventService()
  const result = await service.getEvent(parsed.data)
  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.statusCode },
    )
  }
  return NextResponse.json({ event: result.data })
}

const UpdateEventSchema = z.object({
  title: z.string().min(1).optional(),
  event_type: z.enum(['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament']).optional(),
  start_at: z.string().optional(),
  end_at: z.string().nullable().optional(),
  location_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  player_capacity: z.coerce.number().int().min(1).optional(),
  description: z.string().nullable().optional(),
  visibility: z.enum(['public', 'private', 'invite_only']).optional(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  logger.info('PATCH /api/events/[id]', { id })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const idParsed = lenientUuid.safeParse(id)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid event id format' }, { status: 422 })
  }

  const parsed = UpdateEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing or invalid required fields', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const supabase = createServiceClient()
  const { data: existing, error: fetchError } = await supabase
    .from('events')
    .select('id')
    .eq('id', idParsed.data)
    .maybeSingle()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const service = new EventService()
  const result = await service.updateEvent(id, parsed.data)

  if (result.error) {
    logger.error('PATCH /api/events/[id] failed', { error: result.error.message })
    return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode })
  }

  return NextResponse.json(result.data)
}
