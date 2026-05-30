import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProfileDraftField {
  label: string
  value: string | number | null | undefined
  isRequired: boolean
}

export interface ProfileDraftPanelProps {
  fields: ProfileDraftField[]
  completionPct: number
  missingFields: string[]
  warnings?: string[]
  className?: string
}

// Right-panel summary of the profile draft as it gets filled in conversation.
// Mirrors LiveDraftPanel for consistency but renders profile-specific labels
// and an optional warnings list (e.g. "Add DOB to unlock age-based events").
export function ProfileDraftPanel({
  fields,
  completionPct,
  missingFields,
  warnings = [],
  className,
}: ProfileDraftPanelProps) {
  return (
    <div className={cn('flex h-full flex-col p-5', className)}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Profile Draft</h2>
        <span className="text-xs font-medium text-muted">{completionPct}% complete</span>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${completionPct}%` }}
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="space-y-3">
        {fields.map(({ label, value, isRequired }) => {
          const isFilled = value != null && value !== ''
          return (
            <div key={label} className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                  isFilled
                    ? 'bg-primary'
                    : isRequired
                      ? 'border-2 border-muted-fg'
                      : 'border border-border',
                )}
              >
                {isFilled && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {label}
                  {isRequired && !isFilled && ' *'}
                </p>
                <p
                  className={cn(
                    'text-sm',
                    isFilled ? 'font-medium text-ink' : 'italic text-muted',
                  )}
                >
                  {isFilled ? String(value) : '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {missingFields.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-warm px-3 py-2.5">
          <p className="text-xs font-medium text-amber-700">Still needed:</p>
          <p className="mt-0.5 text-xs text-amber-600">{missingFields.join(', ')}</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
          <p className="text-xs font-medium text-sky-700">Soft suggestions:</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-sky-600">
            {warnings.map(w => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
