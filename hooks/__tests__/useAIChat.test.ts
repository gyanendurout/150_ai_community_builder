import { describe, test, expect } from 'bun:test'
import { useAIChat } from '../useAIChat'

describe('useAIChat hook', () => {
  test('useAIChat is a function', () => {
    expect(typeof useAIChat).toBe('function')
  })
})
