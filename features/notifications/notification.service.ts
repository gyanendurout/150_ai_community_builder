import { logger } from '@/lib/logger'
import { ok, type Result } from '@/lib/errors'

export class NotificationService {
  async sendEventInvite(_eventId: string, _recipientIds: string[]): Promise<Result<void>> {
    logger.info('NotificationService.sendEventInvite (stub — invites not sent in POC)', {
      eventId: _eventId,
      recipientCount: _recipientIds.length,
    })
    return ok(undefined)
  }
}
