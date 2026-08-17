/**
 * Optional Supabase client. Used when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
 * Auth OTP delivery still goes through Aliyun via Edge Function hooks (see supabase/functions).
 */
import { createClient } from '@supabase/supabase-js'

let client = null

export function isSupabaseConfigured() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return !!(url && key)
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (client) return client
  client = createClient(
    String(import.meta.env.VITE_SUPABASE_URL).trim(),
    String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim(),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )
  return client
}
