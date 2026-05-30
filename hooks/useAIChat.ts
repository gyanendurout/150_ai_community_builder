'use client'
import { useState, useCallback } from 'react'

// AI side-channel hints surfaced from the orchestrator. UI uses these to
// drive subflows (DUPR card, assessment modal). Server is the source of
// truth — these hints are advisory only.
export type DuprAction = {
  kind: 'lookup_by_id' | 'lookup_by_name' | 'skip' | 'none'
  value: string | null
}
export type AssessmentAction = 'start' | 'show_result' | 'none'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  quickReplies?: string[]
  requiresApproval?: boolean
  approvalId?: string | null
  approvalAction?: string | null
  missingFields?: string[]
  duprAction?: DuprAction | null
  assessmentAction?: AssessmentAction | null
}

export interface DraftState {
  id: string | null
  fields: Record<string, unknown>
  completionPct: number
  missingFields: string[]
}

export interface UserLocationInput {
  lat: number
  lng: number
  accuracy_m?: number
}

export type ConversationMode = 'event_creation' | 'profile_creation'

export interface UseAIChatOptions {
  userLocation?: UserLocationInput | null
  userTimezone?: string | null
  // NEW in Phase 5 — caller declares which AI mode this chat is for. Default
  // is event_creation to preserve existing /ai-community page behaviour.
  conversationType?: ConversationMode
}

export interface UseAIChatReturn {
  messages: ChatMessage[]
  draft: DraftState
  conversationId: string | null
  conversationType: ConversationMode
  isLoading: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  approveEvent: (approvalId: string) => Promise<string>
  approveProfile: (approvalId: string) => Promise<{ profileId: string; redirectUrl: string }>
}

interface ChatApiResponse {
  conversationId: string
  conversationType: ConversationMode
  draftId: string | null
  approvalId: string | null
  draftFields: Record<string, unknown> | null
  completionPct: number
  aiResponse: {
    assistant_message: string
    intent: string
    quick_replies: string[]
    requires_approval: boolean
    approval_action: string | null
    missing_fields: string[]
    dupr_action: DuprAction | null
    assessment_action: AssessmentAction | null
  }
}

interface EventApiResponse {
  eventId: string
}

interface ProfileApiResponse {
  profileId: string
  redirectUrl: string
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { userLocation, userTimezone, conversationType: initialMode = 'event_creation' } = options
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState<DraftState>({
    id: null,
    fields: {},
    completionPct: 0,
    missingFields: [],
  })
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationType, setConversationType] = useState<ConversationMode>(initialMode)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      setIsLoading(true)
      setError(null)

      const optimisticId = `user-${Date.now()}`
      setMessages(prev => [...prev, { id: optimisticId, role: 'user', content: text }])

      // 30-second hard timeout — prevents indefinite freeze when the AI takes
      // a long time (e.g. complex DUPR name resolution + OpenAI call stall).
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30_000)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            // For a fresh conversation, declare the mode the user picked so the
            // server creates conversations.conversation_type correctly. Once a
            // conversation exists, the server's stored type wins — the client
            // cannot mid-flight switch modes.
            ...(conversationId ? { conversationId } : { conversationType: initialMode }),
            ...(userLocation ? { userLocation } : {}),
            ...(userTimezone ? { userTimezone } : {}),
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as Record<string, unknown>
          throw new Error((errData.error as string | undefined) ?? 'Chat request failed')
        }

        const data = (await res.json()) as ChatApiResponse

        if (data.conversationId) setConversationId(data.conversationId)
        if (data.conversationType) setConversationType(data.conversationType)
        if (data.draftId) {
          setDraft(prev => ({
            ...prev,
            id: data.draftId,
            fields: data.draftFields ?? prev.fields,
            completionPct: data.completionPct ?? prev.completionPct,
            missingFields: data.aiResponse.missing_fields,
          }))
        }

        const assistantId = `assistant-${Date.now()}`
        setMessages(prev => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: data.aiResponse.assistant_message,
            quickReplies: data.aiResponse.quick_replies,
            requiresApproval: data.aiResponse.requires_approval,
            approvalId: data.approvalId,
            approvalAction: data.aiResponse.approval_action,
            missingFields: data.aiResponse.missing_fields,
            duprAction: data.aiResponse.dupr_action,
            assessmentAction: data.aiResponse.assessment_action,
          },
        ])
      } catch (e) {
        clearTimeout(timeoutId)
        const msg =
          e instanceof DOMException && e.name === 'AbortError'
            ? 'Request timed out — please try again.'
            : e instanceof Error
              ? e.message
              : 'Something went wrong. Please try again.'
        setError(msg)
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId, initialMode, isLoading, userLocation, userTimezone],
  )

  const approveEvent = useCallback(async (approvalId: string): Promise<string> => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId }),
    })
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new Error((errData.error as string | undefined) ?? 'Event approval failed')
    }
    const data = (await res.json()) as EventApiResponse
    return data.eventId
  }, [])

  const approveProfile = useCallback(
    async (approvalId: string): Promise<{ profileId: string; redirectUrl: string }> => {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId }),
      })
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error((errData.error as string | undefined) ?? 'Profile approval failed')
      }
      const data = (await res.json()) as ProfileApiResponse
      return { profileId: data.profileId, redirectUrl: data.redirectUrl }
    },
    [],
  )

  return {
    messages,
    draft,
    conversationId,
    conversationType,
    isLoading,
    error,
    sendMessage,
    approveEvent,
    approveProfile,
  }
}
