import { logger } from '@/lib/logger'
import { DuprRepository } from './dupr.repository'
import type {
  DuprLookupQuery,
  DuprLookupResult,
  DuprMatch,
} from './dupr.types'
import type { MockDuprRatingRow } from '@/lib/supabase/types'

// Mock implementation of the DUPR lookup service for the POC.
//
// Production swap: replace this file's body with a real DUPR API call that
// returns the same `DuprLookupResult` discriminated union. Callers stay the
// same because they branch on `status`, not on whether we hit a real API.
export class DuprService {
  constructor(private readonly repo: DuprRepository = new DuprRepository()) {}

  async lookup(query: DuprLookupQuery): Promise<DuprLookupResult> {
    logger.debug('DuprService.lookup', { kind: query.kind })

    if (query.kind === 'skip') {
      return { status: 'skipped' }
    }

    try {
      if (query.kind === 'by_id') {
        const row = await this.repo.findById(query.dupr_id.trim())
        if (!row) return { status: 'not_found' }
        return { status: 'found', match: toMatch(row) }
      }

      // by_name
      const rows = await this.repo.findByName(query.name)
      if (rows.length === 0) return { status: 'not_found' }
      if (rows.length === 1) return { status: 'found', match: toMatch(rows[0]) }
      return { status: 'multiple', matches: rows.map(toMatch) }
    } catch (e) {
      logger.error('DuprService.lookup failed', { kind: query.kind, error: String(e) })
      return { status: 'error', message: 'DUPR lookup is currently unavailable' }
    }
  }
}

function toMatch(row: MockDuprRatingRow): DuprMatch {
  return {
    dupr_id: row.dupr_id,
    full_name: row.full_name,
    rating: Number(row.rating),
  }
}
