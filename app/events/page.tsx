import Link from 'next/link'
import { EventService } from '@/features/events/event.service'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { StatusBadgeVariant } from '@/components/shared/StatusBadge'

function formatDate(iso: string, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz ?? 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function mapEventStatus(status: string): StatusBadgeVariant {
  if (status === 'published') return 'published'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'completed') return 'approved'
  return 'draft'
}

function formatLabel(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default async function EventsListPage() {
  const service = new EventService()
  const result = await service.listAllEvents()
  const events = result.data ?? []

  return (
    <main className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Events</h1>
            <p className="mt-1 text-sm text-muted">
              {events.length} event{events.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <Link
            href="/ai-community"
            className="rounded-full bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            + Create Event
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-10 text-center">
            <p className="text-muted">No events yet.</p>
            <Link href="/ai-community" className="mt-2 inline-block text-sm text-primary hover:underline">
              Create your first event →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map(event => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-ink group-hover:text-primary line-clamp-1">
                    {event.title}
                  </h2>
                  <StatusBadge status={mapEventStatus(event.status)} />
                </div>

                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Type</dt>
                    <dd className="text-ink/80">{formatLabel(event.event_type)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">When</dt>
                    <dd className="text-ink/80">{formatDate(event.start_at, event.timezone)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Where</dt>
                    <dd className="text-ink/80 line-clamp-1">
                      {event.location_name ?? event.address ?? '—'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-xs font-medium text-ink/50">Players</dt>
                    <dd className="text-ink/80">{event.player_capacity}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
