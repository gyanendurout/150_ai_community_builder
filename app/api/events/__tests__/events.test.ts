import { describe, test, expect } from 'bun:test'
import { z } from 'zod'

const CreateEventSchema = z.object({
  approvalId: z.string().uuid(),
})

describe('POST /api/events schema', () => {
  test('accepts valid approvalId', () => {
    const result = CreateEventSchema.safeParse({
      approvalId: '00000000-0000-4000-8000-000000000002',
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing approvalId', () => {
    expect(CreateEventSchema.safeParse({}).success).toBe(false)
  })

  test('rejects non-uuid approvalId', () => {
    expect(CreateEventSchema.safeParse({ approvalId: 'bad-id' }).success).toBe(false)
  })
})
