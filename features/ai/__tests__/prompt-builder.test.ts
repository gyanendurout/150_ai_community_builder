import { describe, test, expect } from 'bun:test'
import { buildSystemPrompt } from '../prompt-builder'
import type { PromptContext } from '../prompt-builder'

const BASE_CONTEXT: PromptContext = {
  conversationType: 'event_creation',
  userName: 'Alex Chen',
  memories: [],
  currentDraft: null,
  availableCourts: [],
  userLocation: null,
  userTimezone: null,
  profileMode: null,
}

describe('buildSystemPrompt', () => {
  test('includes pickleball branding', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).toContain('pickleball')
    expect(prompt).toContain('Joola')
  })

  test('includes conversation type', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).toContain('event_creation')
  })

  test('includes user name', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).toContain('Alex Chen')
  })

  test('injects memory preferences into prompt', () => {
    const ctx: PromptContext = {
      ...BASE_CONTEXT,
      memories: [
        { key: 'preferred_day', value: 'Saturday', confidence: 0.9 },
        { key: 'preferred_court_name', value: 'Joola Court A', confidence: 0.95 },
      ],
    }
    const prompt = buildSystemPrompt(ctx)
    expect(prompt).toContain('preferred_day')
    expect(prompt).toContain('Saturday')
    expect(prompt).toContain('Joola Court A')
  })

  test('includes current draft state when provided', () => {
    const ctx: PromptContext = {
      ...BASE_CONTEXT,
      currentDraft: { event_type: 'doubles', player_capacity: 8 },
    }
    const prompt = buildSystemPrompt(ctx)
    expect(prompt).toContain('doubles')
  })

  test('marks draft as empty when null', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).not.toContain('CURRENT DRAFT STATE')
    expect(prompt).toContain('CURRENT DRAFT: empty')
  })

  test('returns string type', () => {
    expect(typeof buildSystemPrompt(BASE_CONTEXT)).toBe('string')
  })

  test('lists available courts and forbids inventing new ones', () => {
    const ctx: PromptContext = {
      ...BASE_CONTEXT,
      availableCourts: [
        {
          id: '00000000-0000-0000-0000-000000000101',
          name: 'Joola Court A',
          address: '123 Pickleball Ave, SF',
          indoor_outdoor: 'indoor',
          latitude: 37.7749,
          longitude: -122.4194,
          distance_km: null,
        },
      ],
    }
    const prompt = buildSystemPrompt(ctx)
    expect(prompt).toContain('Joola Court A')
    expect(prompt).toContain('AVAILABLE COURTS')
    expect(prompt).toContain('NEVER invent court names')
  })

  test('flags absent user location and prompts to ask for it', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).toContain('USER LOCATION: not shared')
  })

  test('includes user location coordinates when shared', () => {
    const ctx: PromptContext = {
      ...BASE_CONTEXT,
      userLocation: { lat: 37.7749, lng: -122.4194, accuracy_m: 50 },
    }
    const prompt = buildSystemPrompt(ctx)
    expect(prompt).toContain('lat=37.7749')
    expect(prompt).toContain('lng=-122.4194')
    expect(prompt).toContain('±50m')
  })

  test('sorts courts by distance when user location is present', () => {
    const ctx: PromptContext = {
      ...BASE_CONTEXT,
      userLocation: { lat: 37.7749, lng: -122.4194, accuracy_m: null },
      availableCourts: [
        {
          id: 'a',
          name: 'Close Court',
          address: null,
          indoor_outdoor: 'indoor',
          latitude: 37.78,
          longitude: -122.42,
          distance_km: 1.2,
        },
        {
          id: 'b',
          name: 'Far Court',
          address: null,
          indoor_outdoor: 'outdoor',
          latitude: 37.85,
          longitude: -122.5,
          distance_km: 12.4,
        },
      ],
    }
    const prompt = buildSystemPrompt(ctx)
    expect(prompt).toContain('ordered by distance')
    expect(prompt).toContain('1.2 km away')
    expect(prompt).toContain('12.4 km away')
  })

  test('enforces title gate and forbids approval without all required fields', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).toContain('APPROVAL GATE')
    expect(prompt).toContain('title is set in the draft')
  })

  test('includes anti-hallucination rules', () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT)
    expect(prompt).toContain('ANTI-HALLUCINATION RULES')
    expect(prompt).toContain('NEVER claim a court is indoor/outdoor')
    expect(prompt).toContain('NEVER claim to access weather, Google Maps')
  })
})
