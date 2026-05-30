import type React from 'react'
import { cn } from '@/lib/utils'

export interface AIChatShellProps {
  chatContent: React.ReactNode
  chatFooter?: React.ReactNode
  draftContent: React.ReactNode
  className?: string
}

export function AIChatShell({ chatContent, chatFooter, draftContent, className }: AIChatShellProps) {
  return (
    <div className={cn('flex h-screen flex-col overflow-hidden lg:flex-row', className)}>
      {/* Chat column — fills screen on mobile, flexible on desktop */}
      <div className="flex min-h-0 flex-1 flex-col bg-soft">
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
          {chatContent}
        </div>
        {chatFooter && (
          <div className="shrink-0 border-t border-border bg-soft px-4 py-3 space-y-2">
            {chatFooter}
          </div>
        )}
      </div>

      {/* Divider — horizontal rule on mobile, vertical on desktop */}
      <div className="h-px w-full shrink-0 bg-border lg:h-auto lg:w-px" aria-hidden="true" />

      {/* Draft panel — capped height on mobile, fixed width sidebar on desktop */}
      <div className="max-h-[40vh] overflow-y-auto bg-cream lg:max-h-none lg:w-[400px] lg:shrink-0">
        {draftContent}
      </div>
    </div>
  )
}
