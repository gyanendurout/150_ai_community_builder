import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { DraftInsert, DraftRow } from '@/lib/supabase/types'
import type { EventDraft } from '@/features/events/event.types'
import { getEventDraftCompletionPercentage, getMissingEventFields } from '@/features/events/event.types'
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

  async updateDraft(id: string, updates: EventDraft): Promise<Result<DraftRow>> {
    logger.info('DraftService.updateDraft', { id })
    try {
      const existing = await this.repo.findById(id)
      if (!existing) return err('Draft not found', 'DRAFT_NOT_FOUND', 404)
      const nonNullUpdates = Object.fromEntries(
        Object.entries(updates as Record<string, unknown>).filter(([, v]) => v !== null)
      ) as Partial<EventDraft>
      const mergedDraft = { ...(existing.draft_json as EventDraft), ...nonNullUpdates }
      const row = await this.repo.update(id, {
        draft_json: mergedDraft,
        completion_percentage: getEventDraftCompletionPercentage(mergedDraft),
        missing_fields_json: getMissingEventFields(mergedDraft) as unknown as string[],
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
