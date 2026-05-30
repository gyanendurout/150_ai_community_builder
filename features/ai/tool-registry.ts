import { tool } from 'ai'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export type MemoryEntry = { key: string; value: unknown; confidence: number }
export type TimeOption = { label: string; start_at: string; end_at: string }
export type CourtOption = { id: string; name: string; address: string; indoor_outdoor: string; distance_km: number | null }
export type WeatherData = { date: string; condition: string; temp_c: number; suitable_for_outdoor: boolean }
export type TitleSuggestion = { title: string }
export type InviteMessage = { subject: string; body: string }
export type ApprovalPayload = { action_type: 'create_event'; payload: Record<string, unknown> }

export const toolRegistry = {
  get_user_memory: tool({
    description: 'Fetch the user memory preferences relevant to event creation (preferred court, time, player count, event type).',
    inputSchema: z.object({
      user_id: z.string().uuid(),
      memory_keys: z.array(z.string()).optional(),
    }),
    execute: async ({ user_id, memory_keys }) => {
      logger.debug('tool:get_user_memory', { user_id, memory_keys })
      return { memories: [] as MemoryEntry[] }
    },
  }),

  update_event_draft: tool({
    description: 'Update the in-progress event draft with new field values and return the updated draft state.',
    inputSchema: z.object({
      conversation_id: z.string().uuid(),
      user_id: z.string().uuid(),
      updates: z.record(z.string(), z.unknown()),
    }),
    execute: async ({ conversation_id, updates }) => {
      logger.debug('tool:update_event_draft', { conversation_id, fields: Object.keys(updates) })
      return { draft: updates, completion_percentage: 0, missing_fields: [] as string[] }
    },
  }),

  suggest_event_time: tool({
    description: 'Suggest 3 upcoming event time options based on the user preferred day and time from memory.',
    inputSchema: z.object({
      user_id: z.string().uuid(),
      preferred_day: z.string().optional(),
      preferred_time: z.string().optional(),
    }),
    execute: async ({ user_id }) => {
      logger.debug('tool:suggest_event_time', { user_id })
      const now = new Date()
      const options: TimeOption[] = [0, 7, 14].map(daysAhead => {
        const d = new Date(now)
        d.setDate(d.getDate() + daysAhead + (6 - d.getDay()))
        d.setHours(9, 0, 0, 0)
        const end = new Date(d)
        end.setHours(10, 30, 0, 0)
        return {
          label: `Saturday ${d.toLocaleDateString()}`,
          start_at: d.toISOString(),
          end_at: end.toISOString(),
        }
      })
      return { options }
    },
  }),

  suggest_courts: tool({
    description: 'Return the list of available pickleball courts with optional distance estimate.',
    inputSchema: z.object({
      user_id: z.string().uuid(),
      max_results: z.number().int().positive().optional().default(5),
    }),
    execute: async ({ user_id }) => {
      logger.debug('tool:suggest_courts', { user_id })
      return { courts: [] as CourtOption[] }
    },
  }),

  check_weather: tool({
    description: 'Return a weather stub for the requested date and location. Always returns mock data in POC.',
    inputSchema: z.object({
      date: z.string(),
      location: z.string().optional(),
    }),
    execute: async ({ date }) => {
      logger.debug('tool:check_weather', { date })
      const weather: WeatherData = {
        date,
        condition: 'Sunny',
        temp_c: 22,
        suitable_for_outdoor: true,
      }
      return { weather }
    },
  }),

  generate_event_title: tool({
    description: 'Generate 3 event title suggestions based on the current draft fields.',
    inputSchema: z.object({
      event_type: z.string().optional(),
      court_name: z.string().optional(),
      start_at: z.string().optional(),
    }),
    execute: async (input) => {
      logger.debug('tool:generate_event_title', input)
      const day = input.start_at
        ? new Date(input.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Next Saturday'
      const suggestions: TitleSuggestion[] = [
        { title: `${input.event_type === 'doubles' ? 'Doubles' : 'Open'} Play — ${day}` },
        { title: `${input.court_name ?? 'Joola'} ${input.event_type ?? 'Pickleball'} ${day}` },
        { title: `Saturday ${input.event_type === 'doubles' ? 'Doubles' : 'Pickleball'} Session` },
      ]
      return { suggestions }
    },
  }),

  generate_invite_message: tool({
    description: 'Generate a draft invite message for the event. Does NOT send — for review only.',
    inputSchema: z.object({
      event_title: z.string(),
      start_at: z.string().optional(),
      court_name: z.string().optional(),
      player_capacity: z.number().optional(),
    }),
    execute: async (input) => {
      logger.debug('tool:generate_invite_message', { event_title: input.event_title })
      const message: InviteMessage = {
        subject: `Join us: ${input.event_title}`,
        body: `Hey! We're organizing "${input.event_title}" — ${input.start_at ?? 'time TBD'} at ${input.court_name ?? 'Joola Court'}. Capacity: ${input.player_capacity ?? 8} players. Let me know if you can make it!`,
      }
      return { message }
    },
  }),

  prepare_create_event_approval: tool({
    description: 'Assemble the final approval payload for creating the event. Sets requires_approval=true in the AI response.',
    inputSchema: z.object({
      conversation_id: z.string().uuid(),
      user_id: z.string().uuid(),
      draft: z.record(z.string(), z.unknown()),
    }),
    execute: async (input) => {
      logger.debug('tool:prepare_create_event_approval', { conversation_id: input.conversation_id })
      const payload: ApprovalPayload = {
        action_type: 'create_event',
        payload: { ...input.draft, organizer_id: input.user_id },
      }
      return { approval_payload: payload, requires_approval: true }
    },
  }),
} as const

export type ToolName = keyof typeof toolRegistry
export const AI_TOOL_NAMES = Object.keys(toolRegistry) as ToolName[]
