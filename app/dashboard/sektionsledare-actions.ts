'use server'

import { createClient } from '@/lib/supabase/server'

// ── Toggla mat_utdelad för en tilldelning ─────────────────────
export async function toggleMatUtdelad(
  tilldelningId: string,
  nyStatus: boolean
): Promise<{ ok: boolean; meddelande?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, meddelande: 'Inte inloggad' }

  const { error } = await supabase
    .from('tilldelningar')
    .update({ mat_utdelad: nyStatus })
    .eq('id', tilldelningId)

  if (error) {
    console.error('[toggleMatUtdelad] error:', error.message)
    return { ok: false, meddelande: 'Kunde inte uppdatera.' }
  }

  return { ok: true }
}

// ── Koppla sektionsledare till sektion (TL-åtgärd) ───────────
export async function kopplaSLTillSektion(
  slProfilId: string,
  sektionId: string | null
): Promise<{ ok: boolean; meddelande?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { data: tlProfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!tlProfil || tlProfil.role !== 'tl') {
    return { ok: false, meddelande: 'Behörighet saknas' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ sektion_preferens: sektionId })
    .eq('id', slProfilId)

  if (error) {
    console.error('[kopplaSLTillSektion] error:', error.message)
    return { ok: false, meddelande: 'Kunde inte spara.' }
  }

  return { ok: true }
}
