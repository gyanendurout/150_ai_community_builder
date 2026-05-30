import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { DraftInsert, DraftRow, Json } from '@/lib/supabase/types'
import type { EventDraft } from '@/features/events/event.types'
import { getEventDraftCompletionPercentage, getMissingEventFields } from '@/features/events/event.types'
import type { ProfileDraft } from '@/features/profiles/profile.types'
import {
  getProfileDraftCompletionPercentage,
  getMissingProfileFields,
} from '@/features/profiles/profile.types'
import { DraftRepository } from './draft.repository'

export class DraftService {
  constructor(private readonly repo: DraftRepository = new DraftRepository()) {}

  async createDraft(data: DraftInsert): Promise<Result<DraftRow>> {
    logger.info('DraftService.createDraft', { userId: data.user_id, entityType: data.entity_type })
    try {
      const row = await this.repo.insert(data)
      return ok(row)
    } catch (e) {
      logger.error('DraftService.createDraft failed', { error: String(e) })
      return err('Failed to create draft', 'DRAFT_CREATE_FAILED', 500)
    }
  }

  async updateDraft(id: string, updates: Record<string, unknown>): Promise<Result<DraftRow>> {
    logger.info('DraftService.updateDraft', { id })
    try {
      const existing = await this.repo.findById(id)
      if (!existing) return err('Draft not found', 'DRAFT_NOT_FOUND', 404)

      // Defensive filter — same shape as the chat-route filter so a stale
      // null/empty/whitespace update can never clobber a stored string.
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => {
          if (v === null || v === undefined) return false
          if (typeof v === 'string' && v.trim() === '') return false
          return true
        }),
      )
      const mergedDraft = {
        ...(existing.draft_json as Record<string, unknown>),
        ...cleanUpdates,
      }

      // Pick the right helpers for this draft's entity_type — the previous
      // implementation always used the event helpers which stored wrong
      // completion_percentage + missing_fields_json values for profile drafts.
      const isProfile = existing.entity_type === 'profile'
      const completion = isProfile
        ? getProfileDraftCompletionPercentage(mergedDraft as ProfileDraft)
        : getEventDraftCompletionPercentage(mergedDraft as EventDraft)
      const missing = isProfile
        ? getMissingProfileFields(mergedDraft as ProfileDraft)
        : getMissingEventFields(mergedDraft as EventDraft)

      const row = await this.repo.update(id, {
        draft_json: mergedDraft as unknown as Json,
        completion_percentage: completion,
        missing_fields_json: missing as unknown as string[],
      })
      return ok(row)
    } catch (e) {
      logger.error('DraftService.updateDraft failed', { id, error: String(e) })
      return err('Failed to update draft', 'DRAFT_UPDATE_FAILED', 500)
    }
  }

  async getDraftByConversation(conversationId: string): Promise<Result<DraftRow | null>> {
    try {
      const row = await this.repo.findByConversation(conversationId)
      return ok(row)
    } catch (e) {
      logger.error('DraftService.getDraftByConversation failed', { conversationId, error: String(e) })
      return err('Failed to fetch draft', 'DRAFT_FETCH_FAILED', 500)
    }
  }
}
