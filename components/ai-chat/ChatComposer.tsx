'use client'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  className?: string
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder = 'Type a message…',
  disabled = false,
  isLoading = false,
  className,
}: ChatComposerProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) onSend()
    }
  }

  const canSend = value.trim().length > 0 && !disabled && !isLoading

  return (
    <div className={cn('flex items-end gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm', className)}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-xl bg-transparent px-2 py-1.5',
          'text-sm text-ink placeholder:text-muted',
          'focus:outline-none',
          'disabled:opacity-50',
          'max-h-32 overflow-y-auto'
        )}
        aria-label="Chat message input"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send message"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          'transition-all duration-150',
          canSend
            ? 'bg-primary text-white hover:bg-secondary'
            : 'bg-muted-bg text-muted cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
