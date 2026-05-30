import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { UserMemoryRow, Json } from '@/lib/supabase/types'
import { MemoryRepository } from './memory.repository'

export class MemoryService {
  constructor(private readonly repo: MemoryRepository = new MemoryRepository()) {}

  async upsertMemory(userId: string, key: string, value: unknown, memoryType: string): Promise<Result<UserMemoryRow>> {
    logger.debug('MemoryService.upsertMemory', { userId, key, memoryType })
    try {
      const row = await this.repo.upsert({
        user_id: userId,
        memory_key: key,
        memory_value_json: value as Json,
        memory_type: memoryType,
        confidence_score: 0.9,
        source: 'ai_conversation',
        last_used_at: new Date().toISOString(),
      })
      return ok(row)
    } catch (e) {
      logger.error('MemoryService.upsertMemory failed', { userId, key, error: String(e) })
      return err('Failed to upsert memory', 'MEMORY_UPSERT_FAILED', 500)
    }
  }

  async getMemories(userId: string, keys?: string[]): Promise<Result<UserMemoryRow[]>> {
    logger.debug('MemoryService.getMemories', { userId, keyCount: keys?.length })
    try {
      const rows = keys && keys.length > 0
        ? await this.repo.findByUserAndKeys(userId, keys)
        : await this.repo.findByUser(userId)
      return ok(rows)
    } catch (e) {
      logger.error('MemoryService.getMemories failed', { userId, error: String(e) })
      return err('Failed to fetch memories', 'MEMORY_FETCH_FAILED', 500)
    }
  }
}
