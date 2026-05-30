import { describe, test, expect } from 'bun:test'
import { z } from 'zod'

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
})

describe('POST /api/chat schema', () => {
  test('accepts valid message', () => {
    expect(ChatRequestSchema.safeParse({ message: 'Create an 8-player doubles event' }).success).toBe(true)
  })

  test('rejects empty message', () => {
    expect(ChatRequestSchema.safeParse({ message: '' }).success).toBe(false)
  })

  test('accepts message with valid conversationId', () => {
    const result = ChatRequestSchema.safeParse({
      message: 'Create an event',
      conversationId: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid conversationId uuid', () => {
    const result = ChatRequestSchema.safeParse({
      message: 'Create an event',
      conversationId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})
