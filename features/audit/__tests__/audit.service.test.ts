import { describe, test, expect, mock } from 'bun:test'

let insertError: { message: string } | null = null

mock.module('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: async () => ({ error: insertError }),
    }),
  }),
}))

import { AuditService } from '../audit.service'

const AUDIT_ENTRY = {
  user_id: '00000000-0000-0000-0000-000000000001',
  action: 'create_event',
  entity_type: 'event',
  entity_id: '11111111-1111-1111-1111-111111111111',
  conversation_id: null,
  before_state_json: null,
  after_state_json: null,
  ip_address: null,
}

describe('AuditService', () => {
  test('log returns ok when insert succeeds', async () => {
    insertError = null
    const service = new AuditService()
    const result = await service.log(AUDIT_ENTRY)
    expect(result.error).toBeNull()
    expect(result.data).toBeUndefined()
  })

  test('log accepts action and entity fields in entry', async () => {
    insertError = null
    const service = new AuditService()
    const result = await service.log({ ...AUDIT_ENTRY, action: 'approve_event', entity_type: 'approval' })
    expect(result.error).toBeNull()
  })

  test('log returns AUDIT_LOG_FAILED when insert throws', async () => {
    insertError = { message: 'DB write error' }
    const service = new AuditService()
    const result = await service.log(AUDIT_ENTRY)
    expect(result.error?.code).toBe('AUDIT_LOG_FAILED')
    expect(result.error?.statusCode).toBe(500)
    insertError = null
  })
})
