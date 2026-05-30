import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const cache: Record<string, boolean> = {}
let loadedAt: number | null = null
const TTL = 60_000

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const now = Date.now()
  if (!loadedAt || now - loadedAt > TTL) {
    try {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('feature_flags')
        .select('flag_key, enabled')
      if (error) {
        logger.error('Failed to load feature flags', { error: error.message })
        return cache[flagKey] ?? false
      }
      data?.forEach(({ flag_key, enabled }) => { cache[flag_key] = enabled })
      loadedAt = now
    } catch (e) {
      logger.error('Feature flag load exception', { error: String(e) })
    }
  }
  return cache[flagKey] ?? false
}

export const FLAGS = {
  AI_EVENT_CREATION: 'feature_ai_event_creation',
  AI_PROFILE_CREATION: 'feature_ai_profile_creation',
  AI_TOURNAMENT_CREATION: 'feature_ai_tournament_creation',
  WEATHER: 'feature_weather',
  COURT_SEARCH: 'feature_court_search',
  CALENDAR: 'feature_calendar',
  INVITES: 'feature_invites',
} as const
