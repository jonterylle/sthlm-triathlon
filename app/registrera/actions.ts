'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function sparaRegistrering(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hämta och sanera formulärdata
  const full_name       = String(formData.get('full_name') ?? '').trim()
  const telefon         = String(formData.get('telefon') ?? '').trim()
  const klubb           = String(formData.get('klubb') ?? '').trim()
  const sektion_preferens = formData.get('sektion_preferens') as string | null
  const pass_preferens  = formData.get('pass_preferens') as string | null
  const erfarenhet      = String(formData.get('erfarenhet') ?? '').trim()
  const specialkost     = String(formData.get('specialkost') ?? '').trim()

  // Kompetenser är ett antal checkboxar med name="kompetenser"
  const kompetenser = formData.getAll('kompetenser').map(String)

  // Validering
  if (!full_name) {
    redirect('/registrera?error=namn_saknas')
  }

  const giltiga_pass_preferenser = ['forberedelse', 'tavling', 'heldagen', 'ingen_preferens']
  const saniterad_pass_pref = pass_preferens && giltiga_pass_preferenser.includes(pass_preferens)
    ? pass_preferens
    : 'ingen_preferens'

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name,
      telefon:           telefon || null,
      klubb:             klubb || null,
      sektion_preferens: sektion_preferens || null,
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
