import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { ApprovalInsert, ApprovalRow } from '@/lib/supabase/types'
import { ApprovalRepository } from './approval.repository'

export class ApprovalService {
  constructor(private readonly repo: ApprovalRepository = new ApprovalRepository()) {}

  async createApproval(data: ApprovalInsert): Promise<Result<ApprovalRow>> {
    logger.info('ApprovalService.createApproval', { userId: data.user_id, actionType: data.action_type })
    try {
      const row = await this.repo.insert(data)
      return ok(row)
    } catch (e) {
      logger.error('ApprovalService.createApproval failed', { error: String(e) })
      return err('Failed to create approval', 'APPROVAL_CREATE_FAILED', 500)
    }
  }

  async approve(id: string): Promise<Result<ApprovalRow>> {
    logger.info('ApprovalService.approve', { id })
    try {
      const existing = await this.repo.findById(id)
      if (!existing) return err('Approval not found', 'APPROVAL_NOT_FOUND', 404)
      if (existing.status !== 'pending') return err('Approval is not pending', 'APPROVAL_NOT_PENDING', 400)
      const row = await this.repo.update(id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      return ok(row)
    } catch (e) {
      logger.error('ApprovalService.approve failed', { id, error: String(e) })
      return err('Failed to approve', 'APPROVAL_APPROVE_FAILED', 500)
    }
  }

  async reject(id: string): Promise<Result<ApprovalRow>> {
    logger.info('ApprovalService.reject', { id })
    try {
      const existing = await this.repo.findById(id)
      if (!existing) return err('Approval not found', 'APPROVAL_NOT_FOUND', 404)
      if (existing.status !== 'pending') return err('Approval is not pending', 'APPROVAL_NOT_PENDING', 400)
      const row = await this.repo.update(id, {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      return ok(row)
    } catch (e) {
      logger.error('ApprovalService.reject failed', { id, error: String(e) })
      return err('Failed to reject', 'APPROVAL_REJECT_FAILED', 500)
    }
  }
}
