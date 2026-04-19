'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Allowlist för kompetenser — måste matcha checkboxarna i formuläret
const TILLÅTNA_KOMPETENSER = [
  'sjukvard',
  'korkort',
  'triathlon_erfarenhet',
  'simning',
  'cykel_teknik',
  'engelska',
] as const

// Regex för UUID v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function sparaRegistrering(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hämta, sanera och trunkera formulärdata
  const full_name   = String(formData.get('full_name')  ?? '').trim().slice(0, 100)
  const telefon     = String(formData.get('telefon')    ?? '').trim().slice(0, 20)
  const klubb       = String(formData.get('klubb')      ?? '').trim().slice(0, 100)
  const erfarenhet  = String(formData.get('erfarenhet') ?? '').trim().slice(0, 1000)
  const specialkost = String(formData.get('specialkost') ?? '').trim().slice(0, 200)

  // Validera pass_preferens mot allowlist
  const pass_preferens = formData.get('pass_preferens') as string | null
  const giltiga_pass_preferenser = ['forberedelse', 'tavling', 'heldagen', 'ingen_preferens']
  const saniterad_pass_pref = pass_preferens && giltiga_pass_preferenser.includes(pass_preferens)
    ? pass_preferens
    : 'ingen_preferens'

  // Validera sektion_preferens som UUID och kontrollera att sektionen finns
  const rawSektion = formData.get('sektion_preferens') as string | null
  let sektion_preferens: string | null = null
  if (rawSektion && UUID_RE.test(rawSektion)) {
    const { data: sektion } = await supabase
      .from('sektioner')
      .select('id')
      .eq('id', rawSektion)
      .single()
    sektion_preferens = sektion ? rawSektion : null
  }

  // Filtrera kompetenser mot allowlist (förhindrar XSS-lagring)
  const kompetenser = formData
    .getAll('kompetenser')
    .map(String)
    .filter((k): k is typeof TILLÅTNA_KOMPETENSER[number] =>
      (TILLÅTNA_KOMPETENSER as readonly string[]).includes(k)
    )

  // Validering
  if (!full_name) {
    redirect('/registrera?error=namn_saknas')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name,
      telefon:           telefon || null,
      klubb:             klubb || null,
      sektion_preferens,
      pass_preferens:    saniterad_pass_pref,
      erfarenhet:        erfarenhet || null,
      specialkost:       specialkost || null,
      kompetenser,
      registrerad_at:    new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('[registrera] update error:', error.message)
    redirect('/registrera?error=spara_misslyckades')
  }

  redirect('/welcome?registrerad=1')
}
