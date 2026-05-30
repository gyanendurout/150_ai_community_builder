'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAIChat } from '@/hooks/useAIChat'
import { useGeolocation } from '@/hooks/useGeolocation'
import { AIChatShell } from '@/components/ai-chat/AIChatShell'
import { MessageBubble } from '@/components/ai-chat/MessageBubble'
import { SmartChips } from '@/components/ai-chat/SmartChips'
import { ChatComposer } from '@/components/ai-chat/ChatComposer'
import { LiveDraftPanel } from '@/components/event-draft/LiveDraftPanel'
import { ApprovalCard } from '@/components/event-draft/ApprovalCard'
import type { DraftField } from '@/components/event-draft/LiveDraftPanel'

const DRAFT_FIELDS: Array<{ key: string; label: string; isRequired: boolean }> = [
  { key: 'title',           label: 'Title',       isRequired: true  },
  { key: 'event_type',      label: 'Event Type',  isRequired: true  },
  { key: 'start_at',        label: 'Date & Time', isRequired: true  },
  { key: 'player_capacity', label: 'Players',     isRequired: true  },
  { key: 'court_name',      label: 'Court',       isRequired: false },
  { key: 'description',     label: 'Description', isRequired: false },
]

export default function AICommunityPage() {
  const router = useRouter()
  const { coords, status: geoStatus } = useGeolocation({ autoRequest: true })
  const userLocation = useMemo(
    () => (coords ? { lat: coords.lat, lng: coords.lng, accuracy_m: coords.accuracy_m } : null),
    [coords]
  )
  // Browser's IANA timezone (e.g. "Asia/Kolkata", "America/Los_Angeles") —
  // this is the user's ACTUAL current timezone, more reliable than memory.
  const userTimezone = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
    } catch {
      return null
    }
  }, [])
  const { messages, draft, isLoading, error, sendMessage, approveEvent } = useAIChat({ userLocation, userTimezone })
  const [input, setInput] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleChipSelect = useCallback((chip: string) => {
    sendMessage(chip)
  }, [sendMessage])

  // Find the most recent assistant message that requires approval
  const approvalMessage = [...messages].reverse().find(
    m => m.role === 'assistant' && m.requiresApproval && m.approvalId
  ) ?? null

  const handleApprove = useCallback(async () => {
    if (!approvalMessage?.approvalId) return
    setIsApproving(true)
    setApproveError(null)
    try {
      const eventId = await approveEvent(approvalMessage.approvalId)
      router.push(`/events/${eventId}`)
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Failed to create event')
      setIsApproving(false)
    }
  }, [approvalMessage, approveEvent, router])

  const handleReject = useCallback(() => {
    sendMessage("Let's start over with a different event.")
  }, [sendMessage])

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const chips = lastAssistantMsg?.quickReplies ?? []

  const draftFields: DraftField[] = DRAFT_FIELDS.map(({ key, label, isRequired }) => ({
    label,
    value: draft.fields[key] as string | number | null | undefined,
    isRequired,
  }))

  const locationBanner = geoStatus === 'denied' || geoStatus === 'unavailable'
    ? "Location access is off — courts will be suggested based on your saved preferences. Mention a city to search elsewhere."
    : null

  const chatContent = (
    <>
{messages.length === 0 && (
        <p className="text-center text-sm text-muted py-8">
          Start by describing the event you want to create.
        </p>
      )}
      {locationBanner && (
        <p className="text-center text-xs text-muted py-2">{locationBanner}</p>
      )}
      {messages.map(msg => (
        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {isLoading && <MessageBubble role="assistant" content="" isLoading />}
      {error && (
        <p className="text-center text-xs text-red-500 py-1">{error}</p>
      )}
      <div ref={messagesEndRef} />
    </>
  )

  const chatFooter = (
    <>
      {chips.length > 0 && (
        <SmartChips chips={chips} onSelect={handleChipSelect} disabled={isLoading} />
      )}
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        placeholder="Describe your event, e.g. '8-player doubles this Saturday morning'"
      />
    </>
  )

  const draftContent = approvalMessage ? (
    <div className="p-5">
      <ApprovalCard
        title={(draft.fields.title as string | undefined) ?? 'Untitled Event'}
        eventType={(draft.fields.event_type as string | undefined) ?? 'open_play'}
        startAt={(draft.fields.start_at as string | undefined) ?? '—'}
        courtName={(draft.fields.court_name as string | null | undefined) ?? null}
        playerCapacity={(draft.fields.player_capacity as number | undefined) ?? 0}
        description={(draft.fields.description as string | null | undefined) ?? null}
        missingFields={approvalMessage.missingFields ?? []}
        onApprove={handleApprove}
        onReject={handleReject}
        isApproving={isApproving}
      />
      {approveError && (
        <p className="mt-2 text-xs text-red-500">{approveError}</p>
      )}
    </div>
  ) : (
    <LiveDraftPanel
      fields={draftFields}
      completionPct={draft.completionPct}
      missingFields={draft.missingFields}
    />
  )

  return <AIChatShell chatContent={chatContent} chatFooter={chatFooter} draftContent={draftContent} />
}
