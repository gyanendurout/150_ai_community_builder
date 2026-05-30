import { describe, test, expect } from 'bun:test'
import { AIResponseSchema, EventDraftUpdateSchema, validateAIResponse } from '../structured-output-schema'

const VALID_EVENT_CREATION_RESPONSE = {
  assistant_message: 'Let me help you set up that doubles event!',
  intent: 'event_creation' as const,
  draft_update: { event_type: 'doubles', player_capacity: 8 },
  quick_replies: ['Saturday 9am', 'Different time', 'Check courts'],
  tool_calls: ['get_user_memory'],
  requires_approval: false,
  approval_action: null,
  missing_fields: ['title', 'start_at', 'court_id'],
}

describe('AIResponseSchema', () => {
  test('validates a complete event_creation response', () => {
    const result = AIResponseSchema.safeParse(VALID_EVENT_CREATION_RESPONSE)
    expect(result.success).toBe(true)
  })

  test('fails when assistant_message is empty', () => {
    expect(validateAIResponse({ ...VALID_EVENT_CREATION_RESPONSE, assistant_message: '' })).toBeNull()
  })

  test('fails when intent is unknown', () => {
    expect(validateAIResponse({ ...VALID_EVENT_CREATION_RESPONSE, intent: 'unknown_intent' })).toBeNull()
  })

  test('fails when quick_replies exceeds 4 items', () => {
    const tooMany = { ...VALID_EVENT_CREATION_RESPONSE, quick_replies: ['a', 'b', 'c', 'd', 'e'] }
    expect(validateAIResponse(tooMany)).toBeNull()
  })

  test('approval_action must be null when not requiring approval', () => {
    const r = validateAIResponse(VALID_EVENT_CREATION_RESPONSE)
    expect(r?.approval_action).toBeNull()
  })

  test('validates approval flow', () => {
    const approvalResponse = {
      ...VALID_EVENT_CREATION_RESPONSE,
      requires_approval: true,
      approval_action: 'create_event',
      missing_fields: [],
    }
    const r = validateAIResponse(approvalResponse)
    expect(r).not.toBeNull()
    expect(r?.requires_approval).toBe(true)
    expect(r?.approval_action).toBe('create_event')
  })

  test('fails when required fields are missing', () => {
    expect(validateAIResponse({})).toBeNull()
    expect(validateAIResponse({ assistant_message: 'hi' })).toBeNull()
  })
})

describe('EventDraftUpdateSchema', () => {
  test('all fields optional — empty object is valid', () => {
    expect(EventDraftUpdateSchema.safeParse({}).success).toBe(true)
  })

  test('player_capacity must be a positive integer', () => {
    expect(EventDraftUpdateSchema.safeParse({ player_capacity: -1 }).success).toBe(false)
    expect(EventDraftUpdateSchema.safeParse({ player_capacity: 8 }).success).toBe(true)
  })

  test('event_type must be from enum', () => {
    expect(EventDraftUpdateSchema.safeParse({ event_type: 'soccer' }).success).toBe(false)
    expect(EventDraftUpdateSchema.safeParse({ event_type: 'doubles' }).success).toBe(true)
  })
})
