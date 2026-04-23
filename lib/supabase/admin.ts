import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * Supabase admin-klient med service role key.
 * Används BARA i Server Actions och Route Handlers — aldrig på klienten.
 * Kräver SUPABASE_SERVICE_ROLE_KEY i miljövariablerna.
 */
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas i miljövariablerna')
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  })
}
