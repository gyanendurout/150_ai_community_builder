'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAIChat } from '@/hooks/useAIChat'
import { useGeolocation } from '@/hooks/useGeolocation'
import { AIChatShell } from '@/components/ai-chat/AIChatShell'
import { MessageBubble } from '@/components/ai-chat/MessageBubble'
import { SmartChips } from '@/components/ai-chat/SmartChips'
import { ChatComposer } from '@/components/ai-chat/ChatComposer'
import { ProfileDraftPanel } from '@/components/profile-draft/ProfileDraftPanel'
import type { ProfileDraftField } from '@/components/profile-draft/ProfileDraftPanel'
import { ProfileApprovalCard } from '@/components/profile-draft/ProfileApprovalCard'
import { AssessmentModal } from '@/components/profile-draft/AssessmentModal'
import type { AssessmentResult } from '@/components/profile-draft/AssessmentModal'

const PROFILE_DRAFT_FIELDS: Array<{ key: string; label: string; isRequired: boolean }> = [
  { key: 'display_name',       label: 'Display Name',  isRequired: true },
  { key: 'visibility',         label: 'Visibility',    isRequired: true },
  { key: 'skill_source',       label: 'Skill Source',  isRequired: true },
  { key: 'home_court_name',    label: 'Home Court',    isRequired: false },
  { key: 'home_location_text', label: 'Home Location', isRequired: false },
  { key: 'age_band',           label: 'Age Band',      isRequired: false },
  { key: 'gender',             label: 'Gender',        isRequired: false },
  { key: 'bio',                label: 'Bio',           isRequired: false },
]

export default function AIProfilePage() {
  const router = useRouter()
  const { coords, status: geoStatus } = useGeolocation({ autoRequest: true })
  const userLocation = useMemo(
    () => (coords ? { lat: coords.lat, lng: coords.lng, accuracy_m: coords.accuracy_m } : null),
    [coords],
  )
  const userTimezone = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
    } catch {
      return null
    }
  }, [])
  const { messages, draft, isLoading, error, sendMessage, approveProfile, conversationId } = useAIChat({
    userLocation,
    userTimezone,
    conversationType: 'profile_creation',
  })

  const [input, setInput] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [assessmentDone, setAssessmentDone] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // AI-side signal to open the assessment modal. Fire-once so re-renders
  // don't keep popping the modal back open after the user closes it manually.
  const latestAssistantMsg = useMemo(
    () => [...messages].reverse().find(m => m.role === 'assistant'),
    [messages],
  )
  useEffect(() => {
    if (
      latestAssistantMsg?.assessmentAction === 'start' &&
      !assessmentOpen &&
      !assessmentDone
    ) {
      setAssessmentOpen(true)
    }
  }, [latestAssistantMsg, assessmentOpen, assessmentDone])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleChipSelect = useCallback(
    (chip: string) => {
      sendMessage(chip)
    },
    [sendMessage],
  )

  const approvalMessage =
    [...messages].reverse().find(
      m =>
        m.role === 'assistant' &&
        m.requiresApproval &&
        m.approvalId &&
        m.approvalAction === 'save_profile',
    ) ?? null

  const handleApprove = useCallback(async () => {
    if (!approvalMessage?.approvalId) return
    setIsApproving(true)
    setApproveError(null)
    try {
      const { redirectUrl } = await approveProfile(approvalMessage.approvalId)
      router.push(redirectUrl)
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Failed to save profile')
      setIsApproving(false)
    }
  }, [approvalMessage, approveProfile, router])

  const handleReject = useCallback(() => {
    sendMessage("Let's adjust the profile before saving.")
  }, [sendMessage])

  const handleAssessmentComplete = useCallback(
    (result: AssessmentResult) => {
      setAssessmentOpen(false)
      setAssessmentDone(true)
      // Tell the assistant what the (server-computed) result was so it can
      // update the draft with skill_source='assessment' + the verified numbers.
      // The AI itself never invents these — it just acknowledges what the
      // server returned.
      sendMessage(
        `Assessment complete. Server-computed result: app_skill_rating=${result.app_skill_rating}, ` +
          `skill_label=${result.skill_label}, style_profile=${result.style_profile}, ` +
          `confidence=${result.confidence_score}. Please set skill_source to assessment in the draft.`,
      )
    },
    [sendMessage],
  )

  const chips = latestAssistantMsg?.quickReplies ?? []

  const draftFields: ProfileDraftField[] = PROFILE_DRAFT_FIELDS.map(({ key, label, isRequired }) => ({
    label,
    value: draft.fields[key] as string | number | null | undefined,
    isRequired,
  }))

  const locationBanner =
    geoStatus === 'denied' || geoStatus === 'unavailable'
      ? "Location access is off — we'll suggest courts based on what you tell me. Mention a city or court name anytime."
      : null

  const chatContent = (
    <>
{messages.length === 0 && (
        <p className="text-center text-sm text-muted py-8">
          Tell me a bit about yourself — display name, where you usually play, and your skill level.
        </p>
      )}
      {locationBanner && (
        <p className="text-center text-xs text-muted py-2">{locationBanner}</p>
      )}
      {messages.map(msg => (
        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {isLoading && <MessageBubble role="assistant" content="" isLoading />}
      {error && <p className="text-center text-xs text-red-500 py-1">{error}</p>}
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
        placeholder="e.g. 'My display name is Alex, I usually play at Joola Court A, DUPR 3.5'"
      />
    </>
  )

  const draftContent = approvalMessage ? (
    <div className="p-5">
      <ProfileApprovalCard
        displayName={(draft.fields.display_name as string | undefined) ?? 'Unnamed'}
        visibility={(draft.fields.visibility as string | undefined) ?? 'public'}
        homeCourtName={(draft.fields.home_court_name as string | null | undefined) ?? null}
        homeLocationText={(draft.fields.home_location_text as string | null | undefined) ?? null}
        skillSource={
          (draft.fields.skill_source as 'manual' | 'dupr' | 'assessment' | null | undefined) ?? null
        }
        selfRating={(draft.fields.self_rating as number | null | undefined) ?? null}
        duprRating={(draft.fields.dupr_rating as number | null | undefined) ?? null}
        appSkillRating={(draft.fields.app_skill_rating as number | null | undefined) ?? null}
        skillLabel={(draft.fields.skill_label as string | null | undefined) ?? null}
        styleProfile={(draft.fields.style_profile as string | null | undefined) ?? null}
        bio={(draft.fields.bio as string | null | undefined) ?? null}
        missingFields={approvalMessage.missingFields ?? []}
        onApprove={handleApprove}
        onReject={handleReject}
        isApproving={isApproving}
      />
      {approveError && <p className="mt-2 text-xs text-red-500">{approveError}</p>}
    </div>
  ) : (
    <ProfileDraftPanel
      fields={draftFields}
      completionPct={draft.completionPct}
      missingFields={draft.missingFields}
    />
  )

  return (
    <>
      <AIChatShell chatContent={chatContent} chatFooter={chatFooter} draftContent={draftContent} />
      <AssessmentModal
        open={assessmentOpen}
        conversationId={conversationId}
        onClose={() => setAssessmentOpen(false)}
        onComplete={handleAssessmentComplete}
      />
    </>
  )
}
