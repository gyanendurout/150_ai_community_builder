import { describe, test, expect, mock } from 'bun:test'
import { ApprovalService } from '../approval.service'
import type { ApprovalRepository } from '../approval.repository'

const MOCK_APPROVAL_ROW = {
  id: '44444444-4444-4444-4444-444444444444',
  user_id: '00000000-0000-0000-0000-000000000001',
  conversation_id: 'conv-001',
  action_type: 'create_event' as const,
  action_payload_json: { event_id: 'event-001' },
  status: 'pending' as const,
  approved_at: null,
  rejected_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
}

const APPROVAL_INSERT = {
  user_id: '00000000-0000-0000-0000-000000000001',
  conversation_id: 'conv-001',
  action_type: 'create_event' as const,
  action_payload_json: { event_id: 'event-001' },
  status: 'pending' as const,
  approved_at: null,
  rejected_at: null,
}

const buildMockRepo = (overrides: Partial<ApprovalRepository> = {}) => ({
  insert: mock(async () => MOCK_APPROVAL_ROW),
  update: mock(async () => ({ ...MOCK_APPROVAL_ROW, status: 'approved' as const, approved_at: '2026-05-30T01:00:00.000Z' })),
  findById: mock(async () => MOCK_APPROVAL_ROW),
  ...overrides,
})

describe('ApprovalService', () => {
  test('createApproval returns ok with pending status', async () => {
    const service = new ApprovalService(buildMockRepo() as unknown as ApprovalRepository)
    const result = await service.createApproval(APPROVAL_INSERT)
    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('pending')
  })

  test('approve transitions status to approved', async () => {
    const service = new ApprovalService(buildMockRepo() as unknown as ApprovalRepository)
    const result = await service.approve('44444444-4444-4444-4444-444444444444')
    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('approved')
  })

  test('approve returns APPROVAL_NOT_FOUND for missing approval', async () => {
    const service = new ApprovalService(buildMockRepo({ findById: mock(async () => null) }) as unknown as ApprovalRepository)
    const result = await service.approve('missing-id')
    expect(result.error?.code).toBe('APPROVAL_NOT_FOUND')
    expect(result.error?.statusCode).toBe(404)
  })

  test('approve returns APPROVAL_NOT_PENDING when already approved', async () => {
    const approvedRow = { ...MOCK_APPROVAL_ROW, status: 'approved' as const }
    const service = new ApprovalService(buildMockRepo({ findById: mock(async () => approvedRow) }) as unknown as ApprovalRepository)
    const result = await service.approve('44444444-4444-4444-4444-444444444444')
    expect(result.error?.code).toBe('APPROVAL_NOT_PENDING')
    expect(result.error?.statusCode).toBe(400)
  })

  test('reject transitions status to rejected', async () => {
    const rejectUpdate = mock(async () => ({ ...MOCK_APPROVAL_ROW, status: 'rejected' as const, rejected_at: '2026-05-30T01:00:00.000Z' }))
    const service = new ApprovalService(buildMockRepo({ update: rejectUpdate }) as unknown as ApprovalRepository)
    const result = await service.reject('44444444-4444-4444-4444-444444444444')
    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('rejected')
  })

  test('reject returns APPROVAL_NOT_PENDING when already rejected', async () => {
    const rejectedRow = { ...MOCK_APPROVAL_ROW, status: 'rejected' as const }
    const service = new ApprovalService(buildMockRepo({ findById: mock(async () => rejectedRow) }) as unknown as ApprovalRepository)
    const result = await service.reject('44444444-4444-4444-4444-444444444444')
    expect(result.error?.code).toBe('APPROVAL_NOT_PENDING')
  })
})
