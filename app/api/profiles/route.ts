import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { DEMO_USER_ID } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase/server'
import { ApprovalService } from '@/features/approvals/approval.service'
import { ProfileService } from '@/features/profiles/profile.service'
import { MemoryService } from '@/features/memory/memory.service'
import { AuditService } from '@/features/audit/audit.service'
import type { ProfileDraft } from '@/features/profiles/profile.types'
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

const CreateProfileSchema = z.object({
  approvalId: lenientUuid,
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  logger.info('POST /api/profiles')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { approvalId } = parsed.data
  const userId = DEMO_USER_ID
  const supabase = createServiceClient()

  try {
    // 1. Load approval record and verify it is a profile-save approval.
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
    if (approval.action_type !== 'save_profile') {
      return NextResponse.json({ error: 'Approval is not for profile save' }, { status: 400 })
    }

    // 2. Mark the approval as approved BEFORE writing the profile so the
    //    audit chain reflects intent regardless of the save outcome.
    const approvalService = new ApprovalService()
    const approveResult = await approvalService.approve(approvalId)
    if (approveResult.error) {
      logger.error('Failed to approve profile', { error: approveResult.error.message })
      return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
    }

    // 3. Extract draft from approval payload.
    const payload = approval.action_payload_json as Record<string, unknown>
    const draftData = (payload.draft ?? {}) as ProfileDraft

    // 4. Persist via ProfileService — service enforces missing-field guard
    //    and returns 422 for incomplete drafts.
    const profileService = new ProfileService()
    const saveResult = await profileService.saveFromDraft({
      user_id: userId,
      conversation_id: approval.conversation_id,
      draft: draftData,
    })

    if (saveResult.error) {
      logger.error('Failed to save profile', { error: saveResult.error.message })
      return NextResponse.json(
        { error: saveResult.error.message },
        { status: saveResult.error.statusCode },
      )
    }

    const combined = saveResult.data

    // 5. Write audit entry (best-effort — never blocks the save outcome).
    const auditService = new AuditService()
    await auditService.log({
      actor_user_id: userId,
      action: 'profile.created',
      entity_type: 'profile',
      entity_id: combined.profile.id,
      before_json: null,
      after_json: combined.profile as unknown as Json,
    })

    // 6. Mirror key profile facts into user_memory so the existing
    //    event_creation flow can pick them up automatically (home court,
    //    skill level, preferred visibility). All best-effort.
    const memoryService = new MemoryService()
    const memoryWrites: Array<Promise<unknown>> = []
    if (combined.profile.home_court_id) {
      memoryWrites.push(
        memoryService.upsertMemory(
          userId,
          'preferred_court_id',
          combined.profile.home_court_id,
          'preference',
        ),
      )
    }
    if (draftData.home_court_name) {
      memoryWrites.push(
        memoryService.upsertMemory(
          userId,
          'preferred_court_name',
          draftData.home_court_name,
          'preference',
        ),
      )
    }
    if (combined.profile.skill_level) {
      memoryWrites.push(
        memoryService.upsertMemory(
          userId,
          'skill_level',
          combined.profile.skill_level,
          'fact',
        ),
      )
    }
    if (combined.skill?.dupr_rating != null) {
      memoryWrites.push(
        memoryService.upsertMemory(userId, 'dupr_rating', combined.skill.dupr_rating, 'fact'),
      )
    }
    if (combined.skill?.app_skill_rating != null) {
      memoryWrites.push(
        memoryService.upsertMemory(
          userId,
          'app_skill_rating',
          combined.skill.app_skill_rating,
          'fact',
        ),
      )
    }
    if (combined.profile.visibility) {
      memoryWrites.push(
        memoryService.upsertMemory(
          userId,
          'profile_visibility',
          combined.profile.visibility,
          'preference',
        ),
      )
    }
    // Run in parallel; ignore individual failures (logged inside service).
    await Promise.all(memoryWrites)

    logger.info('POST /api/profiles completed', { profileId: combined.profile.id })

    return NextResponse.json({
      profileId: combined.profile.id,
      redirectUrl: `/profiles/${combined.profile.id}`,
    })
  } catch (e) {
    logger.error('Profiles route unexpected error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
