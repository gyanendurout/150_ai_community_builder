import { describe, test, expect } from 'bun:test'
import { EventInsertSchema } from '../event.schema'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

const BASE_INPUT = {
  organizer_id: DEMO_USER_ID,
  title: 'Saturday Doubles',
  start_at: '2026-06-07T09:00:00.000Z',
  player_capacity: 8,
}

describe('EventInsertSchema — organizer_id (lenient UUID)', () => {
  test('accepts standard v4 UUID', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, organizer_id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(r.success).toBe(true)
  })

  test('accepts zero-version demo UUID (00000000-...)', () => {
    const r = EventInsertSchema.safeParse(BASE_INPUT)
    expect(r.success).toBe(true)
    expect(r.data?.organizer_id).toBe(DEMO_USER_ID)
  })

  test('rejects non-UUID string', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, organizer_id: 'not-a-uuid' })
    expect(r.success).toBe(false)
  })

  test('rejects missing organizer_id', () => {
    const { organizer_id: _, ...rest } = BASE_INPUT
    const r = EventInsertSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })
})

describe('EventInsertSchema — sport_type (strOrDefault, Zod v4 null coercion)', () => {
  test('defaults to "pickleball" when sport_type is absent', () => {
    const r = EventInsertSchema.safeParse(BASE_INPUT)
    expect(r.success).toBe(true)
    expect(r.data?.sport_type).toBe('pickleball')
  })

  test('defaults to "pickleball" when sport_type is null', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, sport_type: null })
    expect(r.success).toBe(true)
    expect(r.data?.sport_type).toBe('pickleball')
  })

  test('defaults to "pickleball" when sport_type is undefined', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, sport_type: undefined })
    expect(r.success).toBe(true)
    expect(r.data?.sport_type).toBe('pickleball')
  })

  test('preserves provided sport_type value', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, sport_type: 'tennis' })
    expect(r.success).toBe(true)
    expect(r.data?.sport_type).toBe('tennis')
  })
})

describe('EventInsertSchema — timezone (strOrDefault, Zod v4 null coercion)', () => {
  test('defaults to "UTC" when timezone is absent', () => {
    const r = EventInsertSchema.safeParse(BASE_INPUT)
    expect(r.success).toBe(true)
    expect(r.data?.timezone).toBe('UTC')
  })

  test('defaults to "UTC" when timezone is null', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, timezone: null })
    expect(r.success).toBe(true)
    expect(r.data?.timezone).toBe('UTC')
  })

  test('defaults to "UTC" when timezone is undefined', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, timezone: undefined })
    expect(r.success).toBe(true)
    expect(r.data?.timezone).toBe('UTC')
  })

  test('preserves provided timezone', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, timezone: 'America/Los_Angeles' })
    expect(r.success).toBe(true)
    expect(r.data?.timezone).toBe('America/Los_Angeles')
  })
})

describe('EventInsertSchema — court_id (nullableCoercedUuid)', () => {
  test('coerces null to null', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, court_id: null })
    expect(r.success).toBe(true)
    expect(r.data?.court_id).toBeNull()
  })

  test('coerces undefined to null', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, court_id: undefined })
    expect(r.success).toBe(true)
    expect(r.data?.court_id).toBeNull()
  })

  test('coerces non-UUID string to null', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, court_id: 'not-a-uuid' })
    expect(r.success).toBe(true)
    expect(r.data?.court_id).toBeNull()
  })

  test('preserves valid UUID', () => {
    const uuid = '22222222-2222-4222-8222-222222222222'
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, court_id: uuid })
    expect(r.success).toBe(true)
    expect(r.data?.court_id).toBe(uuid)
  })
})

describe('EventInsertSchema — enum fields with defaults', () => {
  test('visibility defaults to "public"', () => {
    const r = EventInsertSchema.safeParse(BASE_INPUT)
    expect(r.success).toBe(true)
    expect(r.data?.visibility).toBe('public')
  })

  test('status defaults to "published"', () => {
    const r = EventInsertSchema.safeParse(BASE_INPUT)
    expect(r.success).toBe(true)
    expect(r.data?.status).toBe('published')
  })

  test('source defaults to "ai_chat"', () => {
    const r = EventInsertSchema.safeParse(BASE_INPUT)
    expect(r.success).toBe(true)
    expect(r.data?.source).toBe('ai_chat')
  })

  test('rejects invalid visibility value', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, visibility: 'secret' })
    expect(r.success).toBe(false)
  })

  test('rejects invalid status value', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, status: 'archived' })
    expect(r.success).toBe(false)
  })
})

describe('EventInsertSchema — player_capacity validation', () => {
  test('rejects negative player_capacity', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, player_capacity: -1 })
    expect(r.success).toBe(false)
  })

  test('rejects zero player_capacity', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, player_capacity: 0 })
    expect(r.success).toBe(false)
  })

  test('rejects float player_capacity', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, player_capacity: 4.5 })
    expect(r.success).toBe(false)
  })

  test('accepts positive integer player_capacity', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, player_capacity: 64 })
    expect(r.success).toBe(true)
  })
})

describe('EventInsertSchema — title validation', () => {
  test('rejects empty title', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, title: '' })
    expect(r.success).toBe(false)
  })

  test('rejects title exceeding 200 characters', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, title: 'a'.repeat(201) })
    expect(r.success).toBe(false)
  })

  test('accepts title at exactly 200 characters', () => {
    const r = EventInsertSchema.safeParse({ ...BASE_INPUT, title: 'a'.repeat(200) })
    expect(r.success).toBe(true)
  })

  test('rejects missing title', () => {
    const { title: _, ...rest } = BASE_INPUT
    const r = EventInsertSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })
})

describe('EventInsertSchema — complete event with all optional fields', () => {
  test('accepts a fully populated event', () => {
    const r = EventInsertSchema.safeParse({
      organizer_id: DEMO_USER_ID,
      title: 'Summer Tournament',
      description: 'Annual open-play event',
      event_type: 'tournament',
      sport_type: 'pickleball',
      start_at: '2026-07-04T08:00:00.000Z',
      end_at: '2026-07-04T17:00:00.000Z',
      timezone: 'America/New_York',
      court_id: '33333333-3333-4333-8333-333333333333',
      location_name: 'Main Street Courts',
      address: '123 Main St, Springfield, USA',
      latitude: 37.7749,
      longitude: -122.4194,
      player_capacity: 32,
      visibility: 'public',
      status: 'draft',
      source: 'manual',
      created_from_conversation_id: '44444444-4444-4444-8444-444444444444',
    })
    expect(r.success).toBe(true)
    expect(r.data?.event_type).toBe('tournament')
    expect(r.data?.visibility).toBe('public')
    expect(r.data?.status).toBe('draft')
    expect(r.data?.source).toBe('manual')
  })
})
