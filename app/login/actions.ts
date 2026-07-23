'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/database.types'

/**
 * Hämtar rollen från inbjudningar-tabellen för den inloggade användaren,
 * uppdaterar status till "accepterad" och sätter rätt roll på profilen.
 *
 * Anropas efter att en inbjudningslänk (implicit flow / hash-token) har
 * använts för att etablera en session via supabase.auth.setSession() på
 * klientsidan.
 *
 * Obs: Admin-klienten används för inbjudningar eftersom RLS-policyn
 * "TL hanterar inbjudningar" enbart tillåter TL att läsa tabellen.
 *
 * @returns Den roll som skall användas för redirect-beslutet
 */
export async function tillämpInbjudanRoll(): Promise<UserRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return 'funktionar'

  // Admin-klienten kringgår RLS — inbjudningar är bara läsbara av TL annars
  const admin = createAdminClient()

  // Säkerställ att profilen finns — skapar den om trigger missade den
  // (t.ex. inbjudan skickad innan trigger-fix i migration 022 rättades).
  // ignoreDuplicates: true → påverkar inte befintliga profiler.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('profiles') as any).upsert(
    { id: user.id, email: user.email, role: 'funktionar' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  const { data: inbjudan } = await admin
    .from('inbjudningar')
    .select('id, roll')
    .eq('email', user.email)
    .maybeSingle()

  const roll = (inbjudan?.roll as UserRole | undefined) ?? 'funktionar'

  // Markera inbjudan som accepterad
  if (inbjudan?.id) {
    await admin
      .from('inbjudningar')
      .update({ status: 'accepterad' })
      .eq('id', inbjudan.id)
      .eq('status', 'skickad')
  }

  // Uppdatera profilen om rollen är sektionsledare eller tl
  if (roll === 'sektionsledare' || roll === 'tl') {
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
