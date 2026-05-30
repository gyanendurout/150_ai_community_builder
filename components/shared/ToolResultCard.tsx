'use client'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToolStatus = 'running' | 'completed' | 'failed'

export interface ToolResultCardProps {
  toolName: string
  status: ToolStatus
  summary?: string
  className?: string
}

const STATUS_CONFIG: Record<ToolStatus, { icon: React.ReactNode; label: string; style: string }> = {
  running:   { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Running', style: 'text-secondary' },
  completed: { icon: <Check className="h-3.5 w-3.5" />, label: 'Done', style: 'text-green-700' },
  failed:    { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Failed', style: 'text-red-600' },
}

export function ToolResultCard({ toolName, status, summary, className }: ToolResultCardProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-border bg-white px-3 py-2', className)}>
      <span className={cn('mt-0.5 shrink-0', cfg.style)} aria-hidden="true">{cfg.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{toolName}</p>
        {summary && <p className="mt-0.5 text-xs text-ink">{summary}</p>}
      </div>
      <span className={cn('ml-auto shrink-0 text-xs font-medium', cfg.style)}>{cfg.label}</span>
    </div>
  )
}
