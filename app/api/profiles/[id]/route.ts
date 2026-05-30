import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { ProfileRepository } from '@/features/profiles/profile.repository'
import { getProfileDraftCompletionPercentage } from '@/features/profiles/profile.types'

export const runtime = 'nodejs'

const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).optional(),
  visibility: z.enum(['public', 'private', 'friends', 'friends_only', 'event_participants']).optional(),
  age_band: z.enum(['under_18', '18_29', '30_39', '40_49', '50_59', '60_plus', 'prefer_not_to_say']).nullable().optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say', 'self_describe']).nullable().optional(),
  home_location_text: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  skill_source: z.enum(['manual', 'dupr', 'assessment']).optional(),
  self_rating: z.coerce.number().min(1).max(5).nullable().optional(),
  dupr_rating: z.coerce.number().min(2).max(8).nullable().optional(),
  skill_label: z.enum(['beginner', 'developing', 'intermediate', 'advanced', 'expert']).nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  logger.info('PATCH /api/profiles/[id]', { id })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const repo = new ProfileRepository()

  const existing = await repo.findById(id)
  if (!existing) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { skill_source, self_rating, dupr_rating, skill_label, ...profileFields } = parsed.data

  try {
    const merged = { ...existing, ...profileFields }
    const completion = getProfileDraftCompletionPercentage({
      display_name: merged.display_name ?? undefined,
      visibility: merged.visibility ?? undefined,
      age_band: merged.age_band ?? undefined,
      gender: merged.gender ?? undefined,
      home_location_text: merged.home_location_text ?? undefined,
      bio: merged.bio ?? undefined,
    })

    const updatedProfile = await repo.updateProfile(id, {
      ...profileFields,
      profile_completion_percentage: completion,
    })

    const skillRow = await repo.findSkillByUserId(existing.user_id)
    let updatedSkill = skillRow
    if (skillRow && (skill_source !== undefined || self_rating !== undefined || dupr_rating !== undefined || skill_label !== undefined)) {
      updatedSkill = await repo.updateSkill(skillRow.id, {
        ...(skill_source !== undefined && { skill_source }),
        ...(self_rating !== undefined && { self_rating }),
        ...(dupr_rating !== undefined && { dupr_rating }),
        ...(skill_label !== undefined && { skill_label }),
      })
    }

    return NextResponse.json({ profile: updatedProfile, skill: updatedSkill })
  } catch (e) {
    logger.error('PATCH /api/profiles/[id] failed', { error: String(e) })
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
