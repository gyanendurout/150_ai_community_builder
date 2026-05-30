import { logger } from '@/lib/logger'
import { ok, err, type Result } from '@/lib/errors'
import type { CourtRow } from '@/lib/supabase/types'
import { CourtRepository } from './court.repository'

export class CourtService {
  constructor(private readonly repo: CourtRepository = new CourtRepository()) {}

  async listCourts(): Promise<Result<CourtRow[]>> {
    logger.debug('CourtService.listCourts')
    try {
      const rows = await this.repo.findAll()
      return ok(rows)
    } catch (e) {
      logger.error('CourtService.listCourts failed', { error: String(e) })
      return err('Failed to fetch courts', 'COURT_FETCH_FAILED', 500)
    }
  }

  async getCourt(id: string): Promise<Result<CourtRow>> {
    try {
      const row = await this.repo.findById(id)
      if (!row) return err('Court not found', 'COURT_NOT_FOUND', 404)
      return ok(row)
    } catch (e) {
      logger.error('CourtService.getCourt failed', { id, error: String(e) })
      return err('Failed to fetch court', 'COURT_FETCH_FAILED', 500)
    }
  }
}
