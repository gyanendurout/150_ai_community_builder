export const DEMO_USER_ID = process.env.DEMO_USER_ID ?? '00000000-0000-0000-0000-000000000001'

export const SPORT_TYPES = ['pickleball', 'tennis', 'badminton', 'padel'] as const
export type SportType = typeof SPORT_TYPES[number]

export const EVENT_TYPES = ['singles', 'doubles', 'mixed_doubles', 'open_play', 'drill', 'tournament'] as const
export type EventType = typeof EVENT_TYPES[number]

export const CONVERSATION_TYPES = ['event_creation', 'tournament_creation', 'profile_creation', 'event_chat', 'support', 'general'] as const
export type ConversationType = typeof CONVERSATION_TYPES[number]
