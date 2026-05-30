import { describe, test, expect, mock } from 'bun:test'
import { CourtService } from '../court.service'
import type { CourtRepository } from '../court.repository'

const MOCK_COURT_ROW = {
  id: '55555555-5555-5555-5555-555555555555',
  name: 'Riverside Court 1',
  address: '123 Riverside Dr',
  latitude: 37.7749,
  longitude: -122.4194,
  indoor_outdoor: 'outdoor' as const,
  source: 'manual',
  external_place_id: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
}

const buildMockRepo = (overrides: Partial<CourtRepository> = {}) => ({
  findAll: mock(async () => [MOCK_COURT_ROW]),
  findById: mock(async () => MOCK_COURT_ROW),
  ...overrides,
})

describe('CourtService', () => {
  test('listCourts returns all courts', async () => {
    const service = new CourtService(buildMockRepo() as unknown as CourtRepository)
    const result = await service.listCourts()
    expect(result.error).toBeNull()
    expect(result.data?.length).toBe(1)
    expect(result.data?.[0].name).toBe('Riverside Court 1')
  })

  test('listCourts returns empty array when no courts exist', async () => {
    const service = new CourtService(buildMockRepo({ findAll: mock(async () => []) }) as unknown as CourtRepository)
    const result = await service.listCourts()
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  test('getCourt returns specific court by id', async () => {
    const service = new CourtService(buildMockRepo() as unknown as CourtRepository)
    const result = await service.getCourt('55555555-5555-5555-5555-555555555555')
    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('55555555-5555-5555-5555-555555555555')
  })

  test('getCourt returns COURT_NOT_FOUND when court missing', async () => {
    const service = new CourtService(buildMockRepo({ findById: mock(async () => null) }) as unknown as CourtRepository)
    const result = await service.getCourt('missing-id')
    expect(result.error?.code).toBe('COURT_NOT_FOUND')
    expect(result.error?.statusCode).toBe(404)
  })

  test('listCourts returns COURT_FETCH_FAILED when repo throws', async () => {
    const service = new CourtService(buildMockRepo({ findAll: mock(async () => { throw new Error('DB error') }) }) as unknown as CourtRepository)
    const result = await service.listCourts()
    expect(result.error?.code).toBe('COURT_FETCH_FAILED')
    expect(result.error?.statusCode).toBe(500)
  })
})
