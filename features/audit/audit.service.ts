import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { AuditLogInsert } from '@/lib/supabase/types'
import { createServiceClient } from '@/lib/supabase/server'

export class AuditService {
  private get client() { return createServiceClient() }

  async log(entry: Omit<AuditLogInsert, 'id' | 'created_at'>): Promise<Result<void>> {
    logger.info('AuditService.log', {
      action: entry.action,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
    })
    try {
      const { error } = await this.client
        .from('audit_logs')
        .insert(entry)
      if (error) throw new Error(error.message)
      return ok(undefined)
    } catch (e) {
      logger.error('AuditService.log failed', { error: String(e) })
      return err('Failed to write audit log', 'AUDIT_LOG_FAILED', 500)
    }
  }
}
