import { describe, test, expect } from 'bun:test'
import { AIChatShell } from '../AIChatShell'
import { MessageBubble } from '../MessageBubble'
import { SmartChips } from '../SmartChips'
import { ChatComposer } from '../ChatComposer'

describe('ai-chat components', () => {
  test('AIChatShell is a function', () => {
    expect(typeof AIChatShell).toBe('function')
  })

  test('MessageBubble is a function', () => {
    expect(typeof MessageBubble).toBe('function')
  })

  test('SmartChips is a function', () => {
    expect(typeof SmartChips).toBe('function')
  })

  test('ChatComposer is a function', () => {
    expect(typeof ChatComposer).toBe('function')
  })
})
