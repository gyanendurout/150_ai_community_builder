'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EventRow } from '@/lib/supabase/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { StatusBadgeVariant } from '@/components/shared/StatusBadge'

function mapEventStatus(status: string): StatusBadgeVariant {
  if (status === 'published') return 'published'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'completed') return 'approved'
  return 'draft'
}

function formatDate(iso: string, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: tz ?? 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function toDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

interface Props {
  event: EventRow
}

type FormState = {
  title: string
  event_type: string
  start_at: string
  end_at: string
  location_name: string
  address: string
  player_capacity: string
  description: string
  visibility: string
  status: string
}

export function EventDetailClient({ event }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    title: event.title,
    event_type: event.event_type ?? '',
    start_at: toDatetimeLocal(event.start_at),
    end_at: event.end_at ? toDatetimeLocal(event.end_at) : '',
    location_name: event.location_name ?? '',
    address: event.address ?? '',
    player_capacity: String(event.player_capacity),
    description: event.description ?? '',
    visibility: event.visibility,
    status: event.status,
  })

  function field(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          event_type: form.event_type || undefined,
          start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
          end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
          location_name: form.location_name || null,
          address: form.address || null,
          player_capacity: Number(form.player_capacity),
          description: form.description || null,
          visibility: form.visibility,
          status: form.status,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40'
  const labelCls = 'block text-xs font-medium text-ink/60 mb-1'

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-ink">Edit Event</h1>
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setError(null) }}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-soft transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title} onChange={e => field('title', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Event Type</label>
              <select className={inputCls} value={form.event_type} onChange={e => field('event_type', e.target.value)}>
                <option value="">—</option>
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
                <option value="mixed_doubles">Mixed Doubles</option>
                <option value="open_play">Open Play</option>
                <option value="drill">Drill</option>
                <option value="tournament">Tournament</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => field('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Start</label>
              <input type="datetime-local" className={inputCls} value={form.start_at} onChange={e => field('start_at', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End (optional)</label>
              <input type="datetime-local" className={inputCls} value={form.end_at} onChange={e => field('end_at', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Location Name</label>
              <input className={inputCls} value={form.location_name} onChange={e => field('location_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input className={inputCls} value={form.address} onChange={e => field('address', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Player Capacity *</label>
              <input type="number" min={1} className={inputCls} value={form.player_capacity} onChange={e => field('player_capacity', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Visibility</label>
              <select className={inputCls} value={form.visibility} onChange={e => field('visibility', e.target.value)}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="invite_only">Invite Only</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} className={inputCls} value={form.description} onChange={e => field('description', e.target.value)} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-ink sm:text-2xl">{event.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={mapEventStatus(event.status)} />
          <button
            onClick={() => setEditing(true)}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-soft transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Event Details</h2>
        <dl className="space-y-2 text-sm">
          {[
            ['Type',     event.event_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'],
            ['Starts',   formatDate(event.start_at, event.timezone)],
            ['Ends',     event.end_at ? formatDate(event.end_at, event.timezone) : '—'],
            ['Location', event.location_name ?? event.address ?? '—'],
            ['Address',  event.address ?? '—'],
            ['Capacity', String(event.player_capacity)],
            ['Visibility', event.visibility],
            ['Source',   event.source],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-20 shrink-0 text-xs font-medium text-ink/50">{label}</dt>
              <dd className="text-ink/80">{value}</dd>
            </div>
          ))}
          {event.description && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-xs font-medium text-ink/50">Notes</dt>
              <dd className="text-ink/80 whitespace-pre-wrap">{event.description}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
