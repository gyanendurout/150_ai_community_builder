import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { DuprService } from '@/features/ratings/dupr.service'

export const runtime = 'nodejs'

// Discriminated request body — exactly one of the three branches.
const DuprLookupRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('by_id'), dupr_id: z.string().min(1).max(64) }),
  z.object({ kind: z.literal('by_name'), name: z.string().min(2).max(128) }),
  z.object({ kind: z.literal('skip') }),
])

export async function POST(req: NextRequest): Promise<NextResponse> {
  logger.info('POST /api/profiles/dupr-lookup')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DuprLookupRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const duprService = new DuprService()
    const result = await duprService.lookup(parsed.data)
    logger.info('DUPR lookup completed', { status: result.status })
    return NextResponse.json(result)
  } catch (e) {
    logger.error('DUPR lookup unexpected error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
