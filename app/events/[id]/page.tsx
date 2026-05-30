import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EventService } from '@/features/events/event.service'
import { EventDetailClient } from './EventDetailClient'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const service = new EventService()
  const result = await service.getEvent(id)

  if (result.error || !result.data) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/events" className="text-sm font-medium text-primary hover:underline">
          ← All Events
        </Link>
        <EventDetailClient event={result.data} />
      </div>
    </main>
  )
}
