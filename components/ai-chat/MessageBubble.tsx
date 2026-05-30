'use client'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MessageRole = 'user' | 'assistant' | 'tool'

export interface MessageBubbleProps {
  role: MessageRole
  content: string
  timestamp?: string
  toolName?: string
  isLoading?: boolean
  className?: string
}

export function MessageBubble({ role, content, timestamp, toolName, isLoading = false, className }: MessageBubbleProps) {
  const isUser = role === 'user'
  const isTool = role === 'tool'

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start', className)}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isUser && 'rounded-br-sm bg-primary text-white',
          !isUser && !isTool && 'rounded-bl-sm bg-white text-ink shadow-sm border border-border',
          isTool && 'rounded-lg border border-border bg-muted-bg px-3 py-2 text-muted'
        )}
      >
        {isTool && toolName && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{toolName}</p>
        )}
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
            <span className="text-sm text-muted">Thinking…</span>
          </div>
        ) : (
          <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', isTool && 'text-xs')}>{content}</p>
        )}
        {timestamp && (
          <p className={cn('mt-1 text-[10px]', isUser ? 'text-white/60' : 'text-muted')}>{timestamp}</p>
        )}
      </div>
    </div>
  )
}
