'use client'
import { Check, X, Calendar, MapPin, Users, Activity, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ApprovalCardProps {
  title: string
  eventType: string
  startAt: string
  courtName?: string | null
  playerCapacity: number
  description?: string | null
  missingFields?: string[]
  onApprove: () => void
  onReject: () => void
  isApproving?: boolean
  className?: string
}

export function ApprovalCard({
  title,
  eventType,
  startAt,
  courtName,
  playerCapacity,
  description,
  missingFields = [],
  onApprove,
  onReject,
  isApproving = false,
  className,
}: ApprovalCardProps) {
  const formattedType = eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className={cn(
      'flex flex-col gap-4 rounded-2xl border-2 border-primary bg-white p-5 shadow-md',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Ready to Create</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-soft px-3 py-1 text-xs font-medium text-secondary">
          {formattedType}
        </span>
      </div>

      {/* Event details */}
      <dl className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-sm text-ink">{startAt}</span>
        </div>
        {courtName && (
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{courtName}</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-sm text-ink">{playerCapacity} players</span>
        </div>
        {description && (
          <div className="flex items-start gap-2.5">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{description}</span>
          </div>
        )}
      </dl>

      {/* Missing fields warning */}
      {missingFields.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-warm px-3 py-2">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Optional fields missing:</span>{' '}
            {missingFields.join(', ')}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isApproving}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5',
            'text-sm font-semibold text-white transition-colors',
            'hover:bg-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            isApproving && 'cursor-not-allowed opacity-70'
          )}
        >
          {isApproving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isApproving ? 'Creating…' : 'Approve & Create'}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isApproving}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5',
            'text-sm font-medium text-muted transition-colors',
            'hover:border-red-300 hover:text-red-600',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2',
            isApproving && 'cursor-not-allowed opacity-50'
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Reject
        </button>
      </div>
    </div>
  )
}
