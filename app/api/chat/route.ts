import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { DEMO_USER_ID } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase/server'
import { runOrchestrator } from '@/features/ai/ai-orchestrator'
import { MemoryService } from '@/features/memory/memory.service'
import { DraftService } from '@/features/drafts/draft.service'
import { ApprovalService } from '@/features/approvals/approval.service'
import { CourtService } from '@/features/courts/court.service'
import { ProfileService } from '@/features/profiles/profile.service'
import { DuprService } from '@/features/ratings/dupr.service'
import { getEventDraftCompletionPercentage, getMissingEventFields } from '@/features/events/event.types'
import {
  getProfileDraftCompletionPercentage,
  getMissingProfileFields,
  type ProfileDraft,
} from '@/features/profiles/profile.types'
import { filterAndSortCourts, reverseGeocode, findOsmCourts } from '@/lib/geo'
import type { CourtForFilter } from '@/lib/geo'
import type { PromptContext, MemoryContextEntry, CourtContextEntry, UserLocationContext, ProfileModeContext } from '@/features/ai/prompt-builder'
import type { MessageInput } from '@/features/ai/ai-orchestrator'
import type { Json, MessageInsert, AiRunInsert, AiToolCallInsert, DraftInsert, ApprovalInsert } from '@/lib/supabase/types'
import type { EventDraft } from '@/features/events/event.types'
import type { ConversationType } from '@/lib/constants'

export const runtime = 'nodejs'

const UserLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().nonnegative().optional(),
})

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  userLocation: UserLocationSchema.optional(),
  // IANA timezone name from the browser (e.g. "Asia/Kolkata"). Authoritative
  // for the user's current local clock — overrides any timezone in memory.
  userTimezone: z.string().min(1).max(64).optional(),
  // NEW in Phase 3 — caller can declare which AI mode they want when starting
  // a new conversation. For existing conversations, the stored conversation_type
  // wins (we do NOT let the client mid-flight switch modes).
  conversationType: z.enum(['event_creation', 'profile_creation']).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  logger.info('POST /api/chat')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { message, conversationId: incomingConvoId, userLocation, userTimezone, conversationType: requestedType } = parsed.data
  const userId = DEMO_USER_ID
  const supabase = createServiceClient()

  try {
    // 1. Get or create conversation. For NEW conversations the client may
    //    request a mode via `conversationType` — defaulting to event_creation
    //    keeps the historical behaviour. For EXISTING conversations we always
    //    use the persisted type (a client cannot mid-flight switch modes).
    let conversationId = incomingConvoId ?? null
    let conversationType: ConversationType = requestedType ?? 'event_creation'
    if (!conversationId) {
      const { data: convo, error: convoError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          conversation_type: conversationType,
          status: 'active',
          current_entity_type: null,
          current_entity_id: null,
          title: null,
        })
        .select()
        .single()
      if (convoError || !convo) {
        logger.error('Failed to create conversation', { error: String(convoError) })
        return NextResponse.json({ error: 'Failed to start conversation' }, { status: 500 })
      }
      conversationId = convo.id
    } else {
      // Existing conversation — read its persisted type.
      const { data: convo } = await supabase
        .from('conversations')
        .select('conversation_type')
        .eq('id', conversationId)
        .maybeSingle()
      if (convo?.conversation_type) {
        conversationType = convo.conversation_type as ConversationType
      }
    }

    // 2. Load conversation history (user + assistant only — orchestrator builds its own system prompt)
    const { data: historyRows } = await supabase
      .from('conversation_messages')
      .select('role, message_text')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })

    const conversationHistory: MessageInput[] = (historyRows ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.message_text,
    }))

    // 3. Load user memory
    const memoryService = new MemoryService()
    const memoriesResult = await memoryService.getMemories(userId)
    const memories: MemoryContextEntry[] = (memoriesResult.data ?? []).map(m => ({
      key: m.memory_key,
      value: m.memory_value_json,
      confidence: m.confidence_score,
    }))

    // 4. Load current draft
    const draftService = new DraftService()
    const draftResult = await draftService.getDraftByConversation(conversationId)
    const existingDraft = draftResult.data ?? null
    const currentDraft = existingDraft
      ? (existingDraft.draft_json as Record<string, unknown>)
      : null

    // 5a. Load seeded courts from DB + (when user location is known) query
    //     OpenStreetMap Overpass for real pickleball courts within 50 km.
    //     OSM lookup is best-effort with a 3.5s timeout — empty list on failure.
    //     The 100 km filter then drops anything still too far.
    const courtService = new CourtService()
    const seedCourtsResult = await courtService.listCourts()
    const seedRows = seedCourtsResult.data ?? []
    const seedCourts: CourtForFilter[] = seedRows.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      indoor_outdoor: c.indoor_outdoor,
      latitude: c.latitude,
      longitude: c.longitude,
    }))

    let osmCourts: CourtForFilter[] = []
    if (userLocation) {
      osmCourts = await findOsmCourts(userLocation.lat, userLocation.lng, 50000)
      logger.debug('OSM courts fetched', { count: osmCourts.length })
    }

    // De-dupe by name + rounded coords (avoid showing the same court twice when
    // a seeded SF court also appears in OSM).
    const seen = new Set<string>()
    const mergedCourts: CourtForFilter[] = []
    for (const c of [...seedCourts, ...osmCourts]) {
      const lat = c.latitude != null ? c.latitude.toFixed(3) : 'na'
      const lng = c.longitude != null ? c.longitude.toFixed(3) : 'na'
      const key = `${c.name.toLowerCase()}|${lat},${lng}`
      if (seen.has(key)) continue
      seen.add(key)
      mergedCourts.push(c)
    }

    const rankedCourts = filterAndSortCourts(
      mergedCourts,
      userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
    )
    const availableCourts: CourtContextEntry[] = rankedCourts

    // 5b. Reverse-geocode the user's location so the AI can name the city
    //     when telling them "we have no courts in <city> yet".
    let userLocationContext: UserLocationContext | null = null
    if (userLocation) {
      const geo = await reverseGeocode(userLocation.lat, userLocation.lng)
      userLocationContext = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        accuracy_m: userLocation.accuracy_m ?? null,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        country_code: geo.country_code,
      }
    }

    // 5c. For profile_creation conversations, load the user's existing profile
    //     + skill snapshot so the AI can edit instead of starting from scratch.
    //     For event_creation this stays null and the prompt builder skips the
    //     profile-mode section entirely.
    let profileModeContext: ProfileModeContext | null = null
    if (conversationType === 'profile_creation') {
      const profileService = new ProfileService()
      const combinedResult = await profileService.getCombined(userId)
      const profileData = combinedResult.data
      profileModeContext = {
        existingProfile: profileData?.profile
          ? {
              display_name: profileData.profile.display_name,
              visibility: profileData.profile.visibility,
              home_court_id: profileData.profile.home_court_id,
              home_court_name:
                seedRows.find(c => c.id === profileData.profile.home_court_id)?.name ?? null,
              home_location_text: profileData.profile.home_location_text,
              has_dob: !!profileData.profile.dob,
              has_gender: !!profileData.profile.gender,
              has_bio: !!profileData.profile.bio,
            }
          : null,
        existingSkill: profileData?.skill
          ? {
              skill_source: profileData.skill.skill_source,
              dupr_rating: profileData.skill.dupr_rating,
              dupr_status: profileData.skill.dupr_status,
              app_skill_rating: profileData.skill.app_skill_rating,
              skill_label: profileData.skill.skill_label,
              style_profile: profileData.skill.style_profile,
            }
          : null,
        // DUPR + assessment results are per-turn. They are filled by dedicated
        // sub-routes (Phase 4) that mutate the draft and then re-enter the
        // chat. For the first turn they are null.
        duprLookupResult: null,
        assessmentResult: null,
      }
    }

    // 5d. Build PromptContext
    const context: PromptContext = {
      conversationType,
      userName: 'Demo User',
      memories,
      currentDraft,
      availableCourts,
      userLocation: userLocationContext,
      userTimezone: userTimezone ?? null,
      profileMode: profileModeContext,
    }

    // 6. Persist user message
    const userMsgInsert: MessageInsert = {
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      message_text: message,
      message_type: 'text',
      metadata_json: null,
    }
    await supabase.from('conversation_messages').insert(userMsgInsert)

    // 7. Create ai_run record (status = running before orchestrator call)
    const aiRunInsert: AiRunInsert = {
      conversation_id: conversationId,
      user_id: userId,
      model_provider: 'openai',
      model_name: 'gpt-4o',
      input_tokens: null,
      output_tokens: null,
      status: 'running',
      error_message: null,
    }
    const { data: aiRun } = await supabase
      .from('ai_runs')
      .insert(aiRunInsert)
      .select()
      .single()

    // 8. Run AI orchestrator
    const orchestratorResult = await runOrchestrator({
      userMessage: message,
      conversationHistory,
      context,
    })

    if (orchestratorResult.error) {
      if (aiRun) {
        await supabase
          .from('ai_runs')
          .update({ status: 'failed', error_message: orchestratorResult.error.message })
          .eq('id', aiRun.id)
      }
      logger.error('Orchestrator failed in route', { error: orchestratorResult.error.message })
      return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
    }

    const aiResponse = orchestratorResult.data

    // 9. Update ai_run with actual token usage
    if (aiRun) {
      await supabase
        .from('ai_runs')
        .update({
          status: 'completed',
          input_tokens: aiResponse.usage.inputTokens,
          output_tokens: aiResponse.usage.outputTokens,
        })
        .eq('id', aiRun.id)
    }

    // 10. Persist tool call names for audit (AI indicates which tools it used)
    if (aiRun && aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      const toolCallInserts: AiToolCallInsert[] = aiResponse.tool_calls.map(toolName => ({
        ai_run_id: aiRun.id,
        tool_name: toolName,
        input_json: null,
        output_json: null,
        status: 'completed' as const,
        requires_approval: false,
        approved_by_user: null,
      }))
      await supabase.from('ai_tool_calls').insert(toolCallInserts)
    }

    // 11. Upsert draft if AI provided field updates.
    // Strip null values — null means "AI did not change this field", not "field should be cleared".
    // Per conversation_type, the AI populates EITHER draft_update (event mode)
    // OR profile_draft_update (profile mode). Never both.
    let draftId = existingDraft?.id ?? null
    let mergedDraftFields: Record<string, unknown> = currentDraft ?? {}
    let draftCompletionPct = 0
    // SERVER-COMPUTED missing fields — the AI is NOT trusted to enumerate this
    // because it has historically invented combined strings like "court_id or
    // location_name". The server is the single source of truth.
    let serverMissing: string[] = []
    // Banner the server appends to the assistant message when it executes a
    // deterministic sub-flow (DUPR lookup, etc.). Always factual, never AI text.
    let serverBanner = ''

    if (conversationType === 'profile_creation' && aiResponse.profile_draft_update) {
      const rawUpdate = aiResponse.profile_draft_update
      // Defensive filter — strip ANY value that should be treated as "the AI
      // did NOT intend to change this field". Historic regressions came from:
      //   - null    → AI signal for "no change" (per prompt convention)
      //   - undefined → schema theoretically forbids it but defend anyway
      //   - ""      → AI sometimes emits "" for skipped string fields
      //   - whitespace-only strings ("   ") → same as empty for our purposes
      // Without this, an empty/undefined display_name from the AI silently
      // wipes the user-provided name on the next turn (BUG-3).
      const draftUpdate = Object.fromEntries(
        Object.entries(rawUpdate).filter(([, v]) => {
          if (v === null || v === undefined) return false
          if (typeof v === 'string' && v.trim() === '') return false
          return true
        }),
      ) as ProfileDraft

      // ── DUPR auto-execute ─────────────────────────────────────────────
      // When the AI emits a dupr_action signal, the SERVER runs the lookup
      // (the AI is never trusted with the result). On success we merge the
      // verified rating into the draft and append a deterministic banner so
      // the user sees the actual outcome rather than a vague "let me look
      // that up". Failures fall back to a banner explaining the situation.
      const action = aiResponse.dupr_action
      if (action && (action.kind === 'lookup_by_id' || action.kind === 'lookup_by_name') && action.value) {
        const duprService = new DuprService()
        const query =
          action.kind === 'lookup_by_id'
            ? { kind: 'by_id' as const, dupr_id: action.value }
            : { kind: 'by_name' as const, name: action.value }
        // Cap the lookup so a slow / hung DB query can't hold the entire chat
        // turn open. A 5s timeout is well above the typical <100ms response,
        // and falling back to a banner is far better than leaving the user
        // staring at a spinner.
        const lookupPromise = duprService.lookup(query)
        const result = await Promise.race([
          lookupPromise,
          new Promise<{ status: 'error'; message: string }>(resolve =>
            setTimeout(
              () => resolve({ status: 'error', message: 'DUPR lookup timed out' }),
              5_000,
            ),
          ),
        ])
        logger.info('Server-executed DUPR lookup', { kind: action.kind, status: result.status })
        if (result.status === 'found') {
          draftUpdate.skill_source = 'dupr'
          draftUpdate.dupr_rating = result.match.rating
          draftUpdate.dupr_id = result.match.dupr_id
          serverBanner = `\n\nVerified via DUPR lookup → ${result.match.full_name}, rating ${result.match.rating.toFixed(2)}.`
        } else if (result.status === 'not_found') {
          serverBanner =
            `\n\nDUPR lookup returned no match for "${action.value}". ` +
            `You can self-rate, take a 10-question assessment, or try a different DUPR ID/name.`
        } else if (result.status === 'multiple') {
          const list = result.matches
            .map(m => `${m.full_name} (DUPR ${m.dupr_id}, rating ${m.rating.toFixed(2)})`)
            .join('; ')
          serverBanner = `\n\nMultiple DUPR matches for "${action.value}": ${list}. Please share the exact DUPR ID.`
        } else if (result.status === 'error') {
          serverBanner = `\n\nDUPR lookup is currently unavailable. You can self-rate or take the 10-question assessment.`
        }
      }

      mergedDraftFields = { ...(currentDraft ?? {}), ...draftUpdate }
      const profileMerged = mergedDraftFields as ProfileDraft
      draftCompletionPct = getProfileDraftCompletionPercentage(profileMerged)
      serverMissing = getMissingProfileFields(profileMerged)
      if (draftId) {
        await draftService.updateDraft(draftId, draftUpdate as unknown as Record<string, unknown>)
      } else {
        const newDraftInsert: DraftInsert = {
          user_id: userId,
          conversation_id: conversationId,
          entity_type: 'profile',
          entity_id: null,
          draft_json: profileMerged as unknown as Json,
          status: 'draft',
          completion_percentage: draftCompletionPct,
          missing_fields_json: serverMissing as unknown as Json,
          ai_summary: null,
        }
        const newDraftResult = await draftService.createDraft(newDraftInsert)
        draftId = newDraftResult.data?.id ?? null
      }
    } else if (aiResponse.draft_update) {
      const rawUpdate = aiResponse.draft_update
      // Same defensive filter as the profile path — protects required event
      // strings (title, court_name, etc.) from being silently cleared by an
      // empty/whitespace AI payload.
      const draftUpdate = Object.fromEntries(
        Object.entries(rawUpdate).filter(([, v]) => {
          if (v === null || v === undefined) return false
          if (typeof v === 'string' && v.trim() === '') return false
          return true
        }),
      ) as EventDraft
      mergedDraftFields = { ...(currentDraft ?? {}), ...draftUpdate }
      draftCompletionPct = getEventDraftCompletionPercentage(mergedDraftFields as EventDraft)
      serverMissing = getMissingEventFields(mergedDraftFields as EventDraft)
      if (draftId) {
        await draftService.updateDraft(draftId, draftUpdate as unknown as Record<string, unknown>)
      } else {
        const newDraftInsert: DraftInsert = {
          user_id: userId,
          conversation_id: conversationId,
          entity_type: 'event',
          entity_id: null,
          draft_json: draftUpdate as unknown as Json,
          status: 'draft',
          completion_percentage: getEventDraftCompletionPercentage(draftUpdate),
          missing_fields_json: serverMissing as unknown as Json,
          ai_summary: null,
        }
        const newDraftResult = await draftService.createDraft(newDraftInsert)
        draftId = newDraftResult.data?.id ?? null
      }
    } else {
      // No draft update from AI — still compute missing from the current draft so
      // the panel + approval gate use authoritative numbers, not stale ones.
      if (conversationType === 'profile_creation') {
        serverMissing = getMissingProfileFields((currentDraft ?? {}) as ProfileDraft)
      } else {
        serverMissing = getMissingEventFields((currentDraft ?? {}) as EventDraft)
      }
    }

    // 12. Create approval record when (a) AI signals ready AND server agrees,
    //     OR (b) the user explicitly asked to save AND server says draft is
    //     complete. The backstop in (b) covers two real cases:
    //       - The AI is cautious and acknowledges instead of firing approval
    //         even when everything is filled (R01: "Save it" + complete draft).
    //       - A DUPR lookup just completed the draft server-side, so the AI's
    //         response was generated against the pre-lookup state and couldn't
    //         have fired approval (R03: DUPR ID → server merges rating → draft
    //         is now complete but AI didn't know yet).
    // Save-intent detection — matches the multi-word phrases users typically
    // use AND bare imperatives ("Save.", "Approve", "Confirm"). False positives
    // are acceptable because the OTHER guard (serverMissing.length === 0)
    // prevents an incomplete draft from being approved.
    const SAVE_INTENT_RX =
      /\b(save it|please save|save the profile|save my profile|go ahead and save|approve it|approve and save|create the event|create it now|finalize|let'?s save|ready to save|publish (it|the event)|i'?m done|that'?s all|that's everything|^save\.?$|^approve\.?$|^confirm\.?$|^yes,?\s*save\b)\b/i
    // Additionally match a trailing bare "Save." / "Approve." / "Confirm." at the end of any sentence.
    const TRAILING_INTENT_RX = /(?:^|[\s.!?,;])(save|approve|confirm)\.?\s*$/i
    const userWantsSave = SAVE_INTENT_RX.test(message) || TRAILING_INTENT_RX.test(message.trim())
    const aiSignaledApproval = aiResponse.requires_approval && aiResponse.approval_action
    // Type matches AIResponse.approval_action so we can pass it straight back.
    const inferredAction: typeof aiResponse.approval_action =
      aiResponse.approval_action ??
      (conversationType === 'profile_creation'
        ? 'save_profile'
        : conversationType === 'event_creation'
          ? 'create_event'
          : null)
    let approvalId: string | null = null
    let approvalGated = false
    let approvalForcedByUser = false

    if (aiSignaledApproval && serverMissing.length > 0) {
      approvalGated = true
      logger.info('Approval gated by server-computed missing fields', {
        missing: serverMissing,
        action: aiResponse.approval_action,
      })
    } else if (aiSignaledApproval && serverMissing.length === 0 && inferredAction) {
      const approvalService = new ApprovalService()
      const approvalResult = await approvalService.createApproval({
        user_id: userId,
        conversation_id: conversationId,
        action_type: inferredAction,
        action_payload_json: { draft: mergedDraftFields } as unknown as Json,
        status: 'pending',
        approved_at: null,
        rejected_at: null,
      })
      approvalId = approvalResult.data?.id ?? null
    } else if (userWantsSave && serverMissing.length === 0 && inferredAction) {
      approvalForcedByUser = true
      logger.info('Approval force-created from user save intent', {
        action: inferredAction,
        hadAiSignal: aiResponse.requires_approval,
      })
      const approvalService = new ApprovalService()
      const approvalResult = await approvalService.createApproval({
        user_id: userId,
        conversation_id: conversationId,
        action_type: inferredAction,
        action_payload_json: { draft: mergedDraftFields } as unknown as Json,
        status: 'pending',
        approved_at: null,
        rejected_at: null,
      })
      approvalId = approvalResult.data?.id ?? null
    }

    // 13. Persist any memory updates the AI provided
    if (aiResponse.memory_updates && aiResponse.memory_updates.length > 0) {
      for (const update of aiResponse.memory_updates) {
        let parsedValue: unknown
        try {
          parsedValue = JSON.parse(update.value)
        } catch {
          parsedValue = update.value
        }
        await memoryService.upsertMemory(userId, update.key, parsedValue, update.memory_type)
      }
      logger.info('Memory updates saved', { count: aiResponse.memory_updates.length })
    }

    // 15. Persist assistant message — append the server's deterministic banner
    //     (DUPR result, etc.) and a gentle "still missing X" suffix when the
    //     server gated approval. This way the user always sees the truth even
    //     if the AI is vague.
    const gatedSuffix = approvalGated
      ? `\n\n(Holding off on saving until we have: ${serverMissing.join(', ')}.)`
      : ''
    // When the server force-created the approval (because the user clearly
    // asked to save and the draft is complete), append a clear nudge so the
    // user knows what to do next instead of being confused by the AI's vague
    // acknowledgement.
    const forcedSuffix = approvalForcedByUser
      ? `\n\nEverything is filled in — click "Approve & Save${conversationType === 'profile_creation' ? ' Profile' : ''}" on the right to finalize.`
      : ''
    const finalAssistantMessage = aiResponse.assistant_message + serverBanner + gatedSuffix + forcedSuffix
    const assistantMsgInsert: MessageInsert = {
      conversation_id: conversationId,
      user_id: null,
      role: 'assistant',
      message_text: finalAssistantMessage,
      message_type: 'text',
      metadata_json: {
        intent: aiResponse.intent,
        requires_approval: aiResponse.requires_approval && !approvalGated,
        quick_replies: aiResponse.quick_replies ?? [],
        missing_fields: serverMissing,
        approval_gated: approvalGated,
      } as unknown as Json,
    }
    await supabase.from('conversation_messages').insert(assistantMsgInsert)

    logger.info('POST /api/chat completed', {
      conversationId,
      intent: aiResponse.intent,
      requiresApproval: aiResponse.requires_approval,
      draftId,
      approvalId,
    })

    return NextResponse.json({
      conversationId,
      conversationType,
      draftId,
      approvalId,
      draftFields: mergedDraftFields,
      completionPct: draftCompletionPct,
      aiResponse: {
        assistant_message: finalAssistantMessage,
        intent: aiResponse.intent,
        quick_replies: aiResponse.quick_replies ?? [],
        // Approval is signalled when an approvalId was actually created.
        // Covers both AI-initiated and server-forced cases. Gated state
        // results in no approvalId, so this stays false correctly.
        requires_approval: approvalId !== null,
        approval_action: approvalId !== null ? inferredAction : null,
        // Server is the source of truth for missing fields. The AI's invented
        // combined strings ("court_id or location_name") used to leak here.
        missing_fields: serverMissing,
        // Phase 3 — signal the UI to enter assessment subflow / show DUPR card
        assessment_action: aiResponse.assessment_action ?? null,
        // DUPR was either already executed server-side (and merged into the
        // draft) or it was 'skip'/'none'. Either way the UI no longer needs
        // to act on it, so we surface 'none' to prevent double execution.
        dupr_action:
          aiResponse.dupr_action &&
          (aiResponse.dupr_action.kind === 'lookup_by_id' ||
            aiResponse.dupr_action.kind === 'lookup_by_name')
            ? { kind: 'none' as const, value: null }
            : aiResponse.dupr_action ?? null,
      },
    })
  } catch (e) {
    logger.error('Chat route unexpected error', { error: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
