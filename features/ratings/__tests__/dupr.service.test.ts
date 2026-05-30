import { describe, test, expect, mock } from 'bun:test'
import { DuprService } from '../dupr.service'
import type { DuprRepository } from '../dupr.repository'
import type { MockDuprRatingRow } from '@/lib/supabase/types'

const ALEX: MockDuprRatingRow = {
  dupr_id: 'DUPR-DEMO-0001',
  full_name: 'Alex Chen',
  rating: 3.75,
  created_at: '2026-01-01T00:00:00Z',
}
const PRIYA: MockDuprRatingRow = {
  dupr_id: 'DUPR-DEMO-0002',
  full_name: 'Priya Sharma',
  rating: 4.10,
  created_at: '2026-01-01T00:00:00Z',
}

function buildRepo(overrides: Partial<DuprRepository> = {}): DuprRepository {
  return {
    findById: mock(async () => null),
    findByName: mock(async () => []),
    ...overrides,
  } as unknown as DuprRepository
}

describe('DuprService — 7 status states', () => {
  test('[1] kind=skip → status=skipped (user opted out)', async () => {
    const svc = new DuprService(buildRepo())
    const r = await svc.lookup({ kind: 'skip' })
    expect(r.status).toBe('skipped')
  })

  test('[2] by_id found → status=found with single match', async () => {
    const svc = new DuprService(buildRepo({
      findById: mock(async () => ALEX),
    }))
    const r = await svc.lookup({ kind: 'by_id', dupr_id: 'DUPR-DEMO-0001' })
    expect(r.status).toBe('found')
    if (r.status === 'found') {
      expect(r.match.dupr_id).toBe('DUPR-DEMO-0001')
      expect(r.match.rating).toBe(3.75)
    }
  })

  test('[3] by_id not found → status=not_found', async () => {
    const svc = new DuprService(buildRepo({
      findById: mock(async () => null),
    }))
    const r = await svc.lookup({ kind: 'by_id', dupr_id: 'DUPR-MISSING' })
    expect(r.status).toBe('not_found')
  })

  test('[4] by_name with one hit → status=found', async () => {
    const svc = new DuprService(buildRepo({
      findByName: mock(async () => [ALEX]),
    }))
    const r = await svc.lookup({ kind: 'by_name', name: 'Alex' })
    expect(r.status).toBe('found')
    if (r.status === 'found') expect(r.match.full_name).toBe('Alex Chen')
  })

  test('[5] by_name with multiple hits → status=multiple', async () => {
    const svc = new DuprService(buildRepo({
      findByName: mock(async () => [ALEX, PRIYA]),
    }))
    const r = await svc.lookup({ kind: 'by_name', name: 'a' })
    expect(r.status).toBe('multiple')
    if (r.status === 'multiple') expect(r.matches).toHaveLength(2)
  })

  test('[6] by_name with no hits → status=not_found', async () => {
    const svc = new DuprService(buildRepo({
      findByName: mock(async () => []),
    }))
    const r = await svc.lookup({ kind: 'by_name', name: 'zzz' })
    expect(r.status).toBe('not_found')
  })

  test('[7] repository throws → status=error (NOT thrown to caller)', async () => {
    const svc = new DuprService(buildRepo({
      findById: mock(async () => { throw new Error('DB down') }),
    }))
    const r = await svc.lookup({ kind: 'by_id', dupr_id: 'DUPR-DEMO-0001' })
    expect(r.status).toBe('error')
    if (r.status === 'error') expect(r.message).toBeTruthy()
  })

  test('rating is coerced to a number (avoids Supabase decimal-as-string traps)', async () => {
    const svc = new DuprService(buildRepo({
      findById: mock(async () => ({ ...ALEX, rating: '3.75' as unknown as number })),
    }))
    const r = await svc.lookup({ kind: 'by_id', dupr_id: ALEX.dupr_id })
    if (r.status === 'found') {
      expect(typeof r.match.rating).toBe('number')
      expect(r.match.rating).toBe(3.75)
    }
  })
})
