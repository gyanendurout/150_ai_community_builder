import { describe, test, expect, mock } from 'bun:test'
import { MemoryService } from '../memory.service'
import type { MemoryRepository } from '../memory.repository'

const MOCK_MEMORY_ROW = {
  id: '22222222-2222-2222-2222-222222222222',
  user_id: '00000000-0000-0000-0000-000000000001',
  memory_type: 'preference',
  memory_key: 'pref_court',
  memory_value_json: 'Riverside',
  confidence_score: 0.9,
  source: 'ai_inferred',
  last_used_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
}

const buildMockRepo = (overrides: Partial<MemoryRepository> = {}) => ({
  findByUser: mock(async () => [MOCK_MEMORY_ROW]),
  findByUserAndKeys: mock(async () => [MOCK_MEMORY_ROW]),
  ...overrides,
})

describe('MemoryService', () => {
  test('getMemories returns all memories when no keys provided', async () => {
    const repo = buildMockRepo()
    const service = new MemoryService(repo as unknown as MemoryRepository)
    const result = await service.getMemories('00000000-0000-0000-0000-000000000001')
    expect(result.error).toBeNull()
    expect(result.data?.length).toBe(1)
    expect(repo.findByUser).toHaveBeenCalledTimes(1)
    expect(repo.findByUserAndKeys).not.toHaveBeenCalled()
  })

  test('getMemories filters by keys when keys provided', async () => {
    const repo = buildMockRepo()
    const service = new MemoryService(repo as unknown as MemoryRepository)
    const result = await service.getMemories('00000000-0000-0000-0000-000000000001', ['pref_court'])
    expect(result.error).toBeNull()
    expect(repo.findByUserAndKeys).toHaveBeenCalledTimes(1)
    expect(repo.findByUser).not.toHaveBeenCalled()
  })

  test('getMemories returns empty array when user has no memories', async () => {
    const service = new MemoryService(buildMockRepo({ findByUser: mock(async () => []) }) as unknown as MemoryRepository)
    const result = await service.getMemories('00000000-0000-0000-0000-000000000001')
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  test('getMemories with empty keys array falls back to findByUser', async () => {
    const repo = buildMockRepo()
    const service = new MemoryService(repo as unknown as MemoryRepository)
    await service.getMemories('00000000-0000-0000-0000-000000000001', [])
    expect(repo.findByUser).toHaveBeenCalledTimes(1)
    expect(repo.findByUserAndKeys).not.toHaveBeenCalled()
  })

  test('getMemories returns MEMORY_FETCH_FAILED when repo throws', async () => {
    const service = new MemoryService(buildMockRepo({ findByUser: mock(async () => { throw new Error('DB error') }) }) as unknown as MemoryRepository)
    const result = await service.getMemories('00000000-0000-0000-0000-000000000001')
    expect(result.error?.code).toBe('MEMORY_FETCH_FAILED')
    expect(result.error?.statusCode).toBe(500)
  })
})
