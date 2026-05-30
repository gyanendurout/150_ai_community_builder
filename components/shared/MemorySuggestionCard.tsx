'use client'
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MemorySuggestionCardProps {
  label: string
  value: string
  onAccept: () => void
  onDismiss?: () => void
  className?: string
}

export function MemorySuggestionCard({ label, value, onAccept, onDismiss, className }: MemorySuggestionCardProps) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-amber-200 bg-warm p-3', className)}>
      <Brain className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-secondary"
        >
          Use
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
