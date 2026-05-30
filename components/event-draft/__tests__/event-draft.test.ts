import { describe, test, expect } from 'bun:test'
import { EntityPreviewCard } from '../EntityPreviewCard'
import { LiveDraftPanel } from '../LiveDraftPanel'
import { ApprovalCard } from '../ApprovalCard'

describe('event-draft components', () => {
  test('EntityPreviewCard is a function', () => {
    expect(typeof EntityPreviewCard).toBe('function')
  })

  test('LiveDraftPanel is a function', () => {
    expect(typeof LiveDraftPanel).toBe('function')
  })

  test('ApprovalCard is a function', () => {
    expect(typeof ApprovalCard).toBe('function')
  })
})
