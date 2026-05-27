'use server'

import { createClient } from '@/lib/supabase/server'
import type { SektionOmrade } from '@/lib/database.types'

async function verifieraTL() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile || profile.role !== 'tl') return null
  return { supabase, user }
}

// ── Skapa ny sektion ──────────────────────────────────────────
export async function skapaSektion(data: {
  namn: string
  beskrivning?: string
  farg: string
  omrade: SektionOmrade
  behovs_antal: number
  sortorder: number
}): Promise<{ ok: boolean; sektionId?: string; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase, user } = ctx

  const { data: ny, error } = await supabase
    .from('sektioner')
    .insert({
      namn:         data.namn.trim().slice(0, 100),
      beskrivning:  data.beskrivning?.trim() || null,
      farg:         data.farg,
      omrade:       data.omrade,
      behovs_antal: Math.max(1, Math.min(200, data.behovs_antal)),
      sortorder:    data.sortorder,
      skapad_av:    user.id,
      lat:          null,
      lng:          null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[skapaSektion]', error.message)
    return { ok: false, meddelande: 'Kunde inte skapa sektionen.' }
  }
  return { ok: true, sektionId: ny.id }
}

// ── Uppdatera befintlig sektion ───────────────────────────────
export async function uppdateraSektion(
  sektionId: string,
  data: {
    namn: string
    beskrivning?: string
    farg: string
    omrade: SektionOmrade
    behovs_antal: number
    sortorder: number
  }
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('sektioner')
    .update({
      namn:         data.namn.trim().slice(0, 100),
      beskrivning:  data.beskrivning?.trim() || null,
      farg:         data.farg,
      omrade:       data.omrade,
      behovs_antal: Math.max(1, Math.min(200, data.behovs_antal)),
      sortorder:    data.sortorder,
    })
    .eq('id', sektionId)

  if (error) {
    console.error('[uppdateraSektion]', error.message)
    return { ok: false, meddelande: 'Kunde inte spara ändringen.' }
  }
  return { ok: true }
}

// ── Tilldela sektionsledare till sektion ──────────────────────
export async function tilldelaSektionsledare(
  sektionId: string,
  profilId: string
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('sektion_sektionsledare')
    .insert({ sektion_id: sektionId, profil_id: profilId })

  if (error) {
    console.error('[tilldelaSektionsledare]', error.message, error.code)
    if (error.code === '23505') {
      return { ok: false, meddelande: 'Sektionsledaren är redan kopplad till denna sektion.' }
    }
    return { ok: false, meddelande: 'Kunde inte koppla sektionsledaren.' }
  }
  return { ok: true }
}

// ── Ta bort sektionsledare från sektion ───────────────────────
export async function taBortSektionsledare(
  sektionId: string,
  profilId: string
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('sektion_sektionsledare')
    .delete()
    .eq('sektion_id', sektionId)
    .eq('profil_id', profilId)

  if (error) {
    console.error('[taBortSektionsledare]', error.message)
    return { ok: false, meddelande: 'Kunde inte ta bort kopplingen.' }
  }
  return { ok: true }
}

// ── Ta bort sektion ───────────────────────────────────────────
export async function taBortSektion(
  sektionId: string
): Promise<{ ok: boolean; meddelande?: string; harTilldelningar?: boolean }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  // Kontrollera om det finns aktiva tilldelningar på sektionens pass
  const { count } = await supabase
    .from('tilldelningar')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'bekraftad')
    .in(
      'pass_id',
      (await supabase.from('pass').select('id').eq('sektion_id', sektionId)).data?.map(p => p.id) ?? []
    )

  if (count && count > 0) {
    return {
      ok: false,
      harTilldelningar: true,
      meddelande: `Sektionen har ${count} aktiva tilldelning${count === 1 ? '' : 'ar'}. Ta bort dem först.`,
    }
  }

  const { error } = await supabase.from('sektioner').delete().eq('id', sektionId)
  if (error) {
    console.error('[taBortSektion]', error.message)
    return { ok: false, meddelande: 'Kunde inte ta bort sektionen.' }
  }
  return { ok: true }
}
