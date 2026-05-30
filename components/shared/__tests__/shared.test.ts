import { describe, test, expect } from 'bun:test'
import { StatusBadge } from '../StatusBadge'
import { AIOptionCard } from '../AIOptionCard'
import { MemorySuggestionCard } from '../MemorySuggestionCard'
import { ToolResultCard } from '../ToolResultCard'

describe('shared components', () => {
  test('StatusBadge is a function', () => {
    expect(typeof StatusBadge).toBe('function')
  })

  test('AIOptionCard is a function', () => {
    expect(typeof AIOptionCard).toBe('function')
  })

  test('MemorySuggestionCard is a function', () => {
    expect(typeof MemorySuggestionCard).toBe('function')
  })

  test('ToolResultCard is a function', () => {
    expect(typeof ToolResultCard).toBe('function')
  })
})
