'use client'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        published:  'bg-primary text-white',
        draft:      'bg-muted-bg text-muted-fg border border-border',
        pending:    'bg-warm text-ink border border-amber-200',
        approved:   'bg-green-100 text-green-800',
        rejected:   'bg-red-100 text-red-700',
        cancelled:  'bg-gray-100 text-gray-500',
      },
    },
    defaultVariants: { variant: 'draft' },
  }
)

export type StatusBadgeVariant = 'published' | 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status: StatusBadgeVariant
  className?: string
}

const LABELS: Record<StatusBadgeVariant, string> = {
  published: 'Published',
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant: status }), className)}>
      {LABELS[status]}
    </span>
  )
}
