import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FunktionarApp from '@/components/FunktionarApp'
import type { TilldelningInfo } from '@/components/FunktionarApp'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profil } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, telefon, klubb, sektion_preferens, pass_preferens, kompetenser, erfarenhet, specialkost, registrerad_at')
    .eq('id', user.id)
    .single()

  if (!profil) return redirect('/login')
  if (profil.role === 'tl' || profil.role === 'sektionsledare') return redirect('/dashboard')

  // Hämta sektioner för karta och profilformulär parallellt
  const [sektionerRes, sektionValRes, tilldelningRes] = await Promise.all([
    supabase.from('sektion_bemanningsgrad').select('*').order('sortorder'),
    supabase.from('sektioner').select('id, namn').order('sortorder'),
    supabase
      .from('tilldelningar')
      .select('id, pass_id')
      .eq('profil_id', user.id)
      .eq('status', 'bekraftad')
      .maybeSingle(),
  ])

  // Bygg tilldelningsinfo om tilldelning finns — separata queries undviker join-typfel
  let tilldelning: TilldelningInfo = null

  const t = tilldelningRes.data
  if (t?.pass_id) {
    const [passRes] = await Promise.all([
      supabase.from('pass').select('namn, starttid, sluttid, sektion_id').eq('id', t.pass_id).single(),
    ])

    const pass = passRes.data
    if (pass) {
      const [sektionInfoRes, slRes] = await Promise.all([
        supabase.from('sektioner').select('namn, farg').eq('id', pass.sektion_id).single(),
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('sektion_preferens', pass.sektion_id)
          .eq('role', 'sektionsledare')
          .maybeSingle(),
      ])

      tilldelning = {
        pass_namn: pass.namn,
        starttid: pass.starttid,
        sluttid: pass.sluttid,
        sektion_namn: sektionInfoRes.data?.namn ?? 'Okänd sektion',
        sektion_farg: sektionInfoRes.data?.farg ?? '#0066CC',
        sektionsledare_namn: slRes.data?.full_name ?? null,
        sektionsledare_email: slRes.data?.email ?? null,
      }
    }
  }

  return (
    <FunktionarApp
      profil={profil}
      tilldelning={tilldelning}
      sektioner={sektionerRes.data ?? []}
      sektionVal={sektionValRes.data ?? []}
    />
  )
}
