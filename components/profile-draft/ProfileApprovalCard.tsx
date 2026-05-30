'use client'
import { Check, X, User, MapPin, Activity, Eye, Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProfileApprovalCardProps {
  displayName: string
  visibility: string
  homeCourtName?: string | null
  homeLocationText?: string | null
  skillSource?: 'manual' | 'dupr' | 'assessment' | null
  selfRating?: number | null
  duprRating?: number | null
  appSkillRating?: number | null
  skillLabel?: string | null
  styleProfile?: string | null
  bio?: string | null
  missingFields?: string[]
  onApprove: () => void
  onReject: () => void
  isApproving?: boolean
  className?: string
}

function formatVisibility(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatStyle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ProfileApprovalCard({
  displayName,
  visibility,
  homeCourtName,
  homeLocationText,
  skillSource,
  selfRating,
  duprRating,
  appSkillRating,
  skillLabel,
  styleProfile,
  bio,
  missingFields = [],
  onApprove,
  onReject,
  isApproving = false,
  className,
}: ProfileApprovalCardProps) {
  // Skill display chooses the right rating based on source so we don't
  // surface a stale field (e.g. self_rating when the user took the assessment).
  const skillDisplay = (() => {
    if (skillSource === 'dupr' && duprRating != null) {
      return `DUPR ${duprRating.toFixed(2)}`
    }
    if (skillSource === 'assessment' && appSkillRating != null) {
      const label = skillLabel ? ` · ${formatLabel(skillLabel)}` : ''
      return `App rating ${appSkillRating.toFixed(1)}${label}`
    }
    if (skillSource === 'manual' && selfRating != null) {
      return `Self-rated ${selfRating.toFixed(1)}`
    }
    return null
  })()

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border-2 border-primary bg-white p-5 shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Ready to Save Profile
          </p>
          <h3 className="mt-1 text-lg font-bold text-ink">{displayName}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-soft px-3 py-1 text-xs font-medium text-secondary">
          {formatVisibility(visibility)}
        </span>
      </div>

      <dl className="space-y-2.5">
        {(homeCourtName || homeLocationText) && (
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">
              {homeCourtName ?? homeLocationText}
            </span>
          </div>
        )}
        {skillDisplay && (
          <div className="flex items-center gap-2.5">
            <Star className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{skillDisplay}</span>
          </div>
        )}
        {styleProfile && (
          <div className="flex items-center gap-2.5">
            <Activity className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{formatStyle(styleProfile)}</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Eye className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-sm text-ink">{formatVisibility(visibility)}</span>
        </div>
        {bio && (
          <div className="flex items-start gap-2.5">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-sm text-ink">{bio}</span>
          </div>
        )}
      </dl>

      {missingFields.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-warm px-3 py-2">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Optional fields missing:</span>{' '}
            {missingFields.join(', ')}
          </p>
        </div>
      )}

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
            isApproving && 'cursor-not-allowed opacity-70',
          )}
        >
          {isApproving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isApproving ? 'Saving…' : 'Approve & Save Profile'}
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
            isApproving && 'cursor-not-allowed opacity-50',
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Reject
        </button>
      </div>
    </div>
  )
}
