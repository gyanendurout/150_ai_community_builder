import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Service-role client for server-side operations.
 * Bypasses RLS — POC uses this since there is no session auth.
 * Uses SUPABASE_SERVICE_ROLE_KEY which must NEVER have a NEXT_PUBLIC_ prefix.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
