'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/database.types'

/**
 * Hämtar rollen från inbjudningar-tabellen för den inloggade användaren
 * och uppdaterar profilen om rollen inte är 'funktionar'.
 *
 * Anropas efter att en inbjudningslänk (implicit flow / hash-token) har
 * använts för att etablera en session.
 *
 * @returns Den roll som profilen skall ha (används för redirect-beslut)
 */
export async function tillämpInbjudanRoll(): Promise<UserRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return 'funktionar'

  // Hämta rollen från inbjudningen (RLS: inbjudningar_select_own tillåter detta)
  const { data: inbjudan } = await supabase
    .from('inbjudningar')
    .select('roll')
    .eq('email', user.email)
    .maybeSingle()

  const roll = (inbjudan?.roll as UserRole | undefined) ?? 'funktionar'

  // Uppdatera profilen via admin-klienten om rollen är sektionsledare eller tl
  if (roll === 'sektionsledare' || roll === 'tl') {
    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ role: roll })
      .eq('id', user.id)

    if (error) {
      console.error('[tillämpInbjudanRoll] kunde inte sätta roll:', error.message)
    }
  }

  return roll
}
