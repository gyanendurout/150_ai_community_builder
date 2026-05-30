'use client'
import { cn } from '@/lib/utils'

export interface SmartChipsProps {
  chips: string[]
  onSelect: (chip: string) => void
  disabled?: boolean
  className?: string
}

export function SmartChips({ chips, onSelect, disabled = false, className }: SmartChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2 py-1', className)} role="group" aria-label="Quick reply options">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          disabled={disabled}
          className={cn(
            'rounded-full border border-primary px-3.5 py-2.5 text-sm font-medium text-primary',
            'transition-colors duration-150',
            'hover:bg-primary hover:text-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
