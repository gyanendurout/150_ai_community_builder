import { cn } from '@/lib/utils'

export interface EntityPreviewField {
  label: string
  value: string | number | null | undefined
}

export interface EntityPreviewCardProps {
  title: string
  fields: EntityPreviewField[]
  className?: string
}

export function EntityPreviewCard({ title, fields, className }: EntityPreviewCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-white p-4 shadow-sm', className)}>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <dl className="space-y-2">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="w-24 shrink-0 text-xs text-muted">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {value != null && value !== '' ? String(value) : (
                <span className="text-muted italic">—</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
