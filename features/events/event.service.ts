import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { EventRow } from '@/lib/supabase/types'
import { EventInsertSchema } from './event.schema'
import { EventRepository } from './event.repository'

export class EventService {
  constructor(private readonly repo: EventRepository = new EventRepository()) {}

  async createEvent(data: unknown): Promise<Result<EventRow>> {
    logger.info('EventService.createEvent start')
    const validated = EventInsertSchema.safeParse(data)
    if (!validated.success) {
      logger.warn('EventService.createEvent validation failed', { issues: validated.error.issues.map(i => ({ path: i.path, msg: i.message })) })
      return err('Invalid event data', 'VALIDATION_ERROR', 400)
    }
    try {
      const row = await this.repo.insert(validated.data)
      logger.info('EventService.createEvent succeeded', { id: row.id })
      return ok(row)
    } catch (e) {
      logger.error('EventService.createEvent failed', { error: String(e) })
      return err('Failed to create event', 'EVENT_CREATE_FAILED', 500)
    }
  }

  async getEvent(id: string): Promise<Result<EventRow>> {
    try {
      const row = await this.repo.findById(id)
      if (!row) return err('Event not found', 'EVENT_NOT_FOUND', 404)
      return ok(row)
    } catch (e) {
      logger.error('EventService.getEvent failed', { id, error: String(e) })
      return err('Failed to fetch event', 'EVENT_FETCH_FAILED', 500)
    }
  }

  async listEvents(organizerId: string): Promise<Result<EventRow[]>> {
    try {
      const rows = await this.repo.findByOrganizer(organizerId)
      return ok(rows)
    } catch (e) {
      logger.error('EventService.listEvents failed', { organizerId, error: String(e) })
      return err('Failed to list events', 'EVENT_LIST_FAILED', 500)
    }
  }

  async listAllEvents(): Promise<Result<EventRow[]>> {
    try {
      const rows = await this.repo.findAll()
      return ok(rows)
    } catch (e) {
      logger.error('EventService.listAllEvents failed', { error: String(e) })
      return err('Failed to list events', 'EVENT_LIST_FAILED', 500)
    }
  }

  async updateEvent(id: string, data: Record<string, unknown>): Promise<Result<EventRow>> {
    try {
      const row = await this.repo.update(id, data)
      logger.info('EventService.updateEvent succeeded', { id })
      return ok(row)
    } catch (e) {
      logger.error('EventService.updateEvent failed', { id, error: String(e) })
      return err('Failed to update event', 'EVENT_UPDATE_FAILED', 500)
    }
  }
}
