import { describe, test, expect, mock } from 'bun:test'
import { DraftService } from '../draft.service'
import type { DraftRepository } from '../draft.repository'

const MOCK_DRAFT_ROW = {
  id: '33333333-3333-3333-3333-333333333333',
  user_id: '00000000-0000-0000-0000-000000000001',
  conversation_id: 'conv-001',
  entity_type: 'event' as const,
  entity_id: null,
  draft_json: { title: 'Saturday Doubles', player_capacity: 8 },
  status: 'draft' as const,
  completion_percentage: 50,
  missing_fields_json: ['start_at', 'event_type'],
  ai_summary: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
}

const DRAFT_INSERT = {
  user_id: '00000000-0000-0000-0000-000000000001',
  conversation_id: 'conv-001',
  entity_type: 'event' as const,
  entity_id: null,
  draft_json: { title: 'Saturday Doubles' },
  status: 'draft' as const,
  completion_percentage: 0,
  missing_fields_json: ['title', 'start_at', 'event_type', 'player_capacity'],
  ai_summary: null,
}

const buildMockRepo = (overrides: Partial<DraftRepository> = {}) => ({
  insert: mock(async () => MOCK_DRAFT_ROW),
  update: mock(async () => ({ ...MOCK_DRAFT_ROW, completion_percentage: 75 })),
  findById: mock(async () => MOCK_DRAFT_ROW),
  findByConversation: mock(async () => MOCK_DRAFT_ROW),
  ...overrides,
})

describe('DraftService', () => {
  test('createDraft returns ok with draft row', async () => {
    const service = new DraftService(buildMockRepo() as unknown as DraftRepository)
    const result = await service.createDraft(DRAFT_INSERT)
    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('33333333-3333-3333-3333-333333333333')
  })

  test('createDraft returns DRAFT_CREATE_FAILED when repo throws', async () => {
    const service = new DraftService(buildMockRepo({ insert: mock(async () => { throw new Error('DB error') }) }) as unknown as DraftRepository)
    const result = await service.createDraft(DRAFT_INSERT)
    expect(result.error?.code).toBe('DRAFT_CREATE_FAILED')
  })

  test('updateDraft merges fields into existing draft_json', async () => {
    const service = new DraftService(buildMockRepo() as unknown as DraftRepository)
    const result = await service.updateDraft('33333333-3333-3333-3333-333333333333', { title: 'Updated Title', start_at: '2026-06-07T09:00:00Z' })
    expect(result.error).toBeNull()
  })

  test('updateDraft recalculates completion_percentage', async () => {
    const repo = buildMockRepo()
    const service = new DraftService(repo as unknown as DraftRepository)
    await service.updateDraft('33333333-3333-3333-3333-333333333333', { title: 'Test', start_at: '2026-06-07', event_type: 'doubles', player_capacity: 8 })
    expect(repo.update).toHaveBeenCalledTimes(1)
    const updateArgs = (repo.update.mock.calls[0] as unknown[])[1] as { completion_percentage: number }
    expect(typeof updateArgs.completion_percentage).toBe('number')
  })

  test('updateDraft returns DRAFT_NOT_FOUND when draft missing', async () => {
    const service = new DraftService(buildMockRepo({ findById: mock(async () => null) }) as unknown as DraftRepository)
    const result = await service.updateDraft('missing-id', { title: 'Test' })
    expect(result.error?.code).toBe('DRAFT_NOT_FOUND')
    expect(result.error?.statusCode).toBe(404)
  })

  test('getDraftByConversation returns null when no draft exists', async () => {
    const service = new DraftService(buildMockRepo({ findByConversation: mock(async () => null) }) as unknown as DraftRepository)
    const result = await service.getDraftByConversation('conv-999')
    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
  })

  test('getDraftByConversation returns existing draft', async () => {
    const service = new DraftService(buildMockRepo() as unknown as DraftRepository)
    const result = await service.getDraftByConversation('conv-001')
    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('33333333-3333-3333-3333-333333333333')
  })
})
