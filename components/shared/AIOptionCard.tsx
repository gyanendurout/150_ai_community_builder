'use client'
import { cn } from '@/lib/utils'

export interface AIOptionCardProps {
  title: string
  subtitle?: string
  badge?: string
  onSelect: () => void
  isSelected?: boolean
  className?: string
}

export function AIOptionCard({ title, subtitle, badge, onSelect, isSelected = false, className }: AIOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all duration-150',
        'hover:border-primary hover:bg-soft',
        isSelected
          ? 'border-primary bg-soft ring-1 ring-primary'
          : 'border-border bg-white',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-xs font-medium text-secondary">
            {badge}
          </span>
        )}
      </div>
    </button>
  )
}
