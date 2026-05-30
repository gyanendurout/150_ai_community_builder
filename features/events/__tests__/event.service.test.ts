import { describe, test, expect, mock } from 'bun:test'
import { EventService } from '../event.service'
import type { EventRepository } from '../event.repository'

const MOCK_EVENT_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  organizer_id: '00000000-0000-4000-8000-000000000001',
  title: 'Saturday Doubles',
  description: null,
  event_type: 'doubles' as const,
  sport_type: 'pickleball',
  start_at: '2026-06-07T09:00:00.000Z',
  end_at: null,
  timezone: 'UTC',
  court_id: null,
  location_name: null,
  address: null,
  latitude: null,
  longitude: null,
  player_capacity: 8,
  visibility: 'public' as const,
  status: 'published' as const,
  source: 'ai_chat' as const,
  created_from_conversation_id: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
}

const VALID_INPUT = {
  organizer_id: '00000000-0000-4000-8000-000000000001',
  title: 'Saturday Doubles',
  start_at: '2026-06-07T09:00:00.000Z',
  player_capacity: 8,
}

const buildMockRepo = (overrides: Partial<EventRepository> = {}) => ({
  insert: mock(async () => MOCK_EVENT_ROW),
  findById: mock(async () => MOCK_EVENT_ROW),
  findByOrganizer: mock(async () => [MOCK_EVENT_ROW]),
  ...overrides,
})

describe('EventService', () => {
  test('createEvent returns ok with created row', async () => {
    const service = new EventService(buildMockRepo() as unknown as EventRepository)
    const result = await service.createEvent(VALID_INPUT)
    expect(result.error).toBeNull()
    expect(result.data?.title).toBe('Saturday Doubles')
  })

  test('createEvent returns VALIDATION_ERROR for missing required fields', async () => {
    const service = new EventService(buildMockRepo() as unknown as EventRepository)
    const result = await service.createEvent({ title: 'No start_at' })
    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('VALIDATION_ERROR')
  })

  test('createEvent returns VALIDATION_ERROR for negative player_capacity', async () => {
    const service = new EventService(buildMockRepo() as unknown as EventRepository)
    const result = await service.createEvent({ ...VALID_INPUT, player_capacity: -1 })
    expect(result.error?.code).toBe('VALIDATION_ERROR')
  })

  test('createEvent returns VALIDATION_ERROR for zero player_capacity', async () => {
    const service = new EventService(buildMockRepo() as unknown as EventRepository)
    const result = await service.createEvent({ ...VALID_INPUT, player_capacity: 0 })
    expect(result.error?.code).toBe('VALIDATION_ERROR')
  })

  test('getEvent returns ok when event exists', async () => {
    const service = new EventService(buildMockRepo() as unknown as EventRepository)
    const result = await service.getEvent('11111111-1111-4111-8111-111111111111')
    expect(result.data?.id).toBe('11111111-1111-4111-8111-111111111111')
  })

  test('getEvent returns EVENT_NOT_FOUND when repo returns null', async () => {
    const service = new EventService(buildMockRepo({ findById: mock(async () => null) }) as unknown as EventRepository)
    const result = await service.getEvent('non-existent-id')
    expect(result.error?.code).toBe('EVENT_NOT_FOUND')
    expect(result.error?.statusCode).toBe(404)
  })

  test('listEvents returns array of events', async () => {
    const service = new EventService(buildMockRepo() as unknown as EventRepository)
    const result = await service.listEvents('00000000-0000-4000-8000-000000000001')
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data?.length).toBe(1)
  })

  test('createEvent returns EVENT_CREATE_FAILED when repo throws', async () => {
    const service = new EventService(buildMockRepo({ insert: mock(async () => { throw new Error('DB error') }) }) as unknown as EventRepository)
    const result = await service.createEvent(VALID_INPUT)
    expect(result.error?.code).toBe('EVENT_CREATE_FAILED')
  })

  test('getEvent returns EVENT_FETCH_FAILED when repo throws', async () => {
    const service = new EventService(buildMockRepo({ findById: mock(async () => { throw new Error('DB error') }) }) as unknown as EventRepository)
    const result = await service.getEvent('some-id')
    expect(result.error?.code).toBe('EVENT_FETCH_FAILED')
  })
})
