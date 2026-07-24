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

  // Hämta sektioner och ALLA bekräftade tilldelningar parallellt
  const [sektionerRes, sektionValRes, tilldelningarRes] = await Promise.all([
    supabase.from('sektion_bemanningsgrad').select('*').order('sortorder'),
    supabase.from('sektioner').select('id, namn').order('sortorder'),
    supabase
      .from('tilldelningar')
      .select('id, pass_id')
      .eq('profil_id', user.id)
      .eq('status', 'bekraftad'),   // ← ingen .maybeSingle(), returnerar array
  ])

  // Bygg TilldelningInfo för varje tilldelning parallellt
  const rawTilldelningar = tilldelningarRes.data ?? []

  const tilldelningar: TilldelningInfo[] = (
    await Promise.all(
      rawTilldelningar.map(async (t) => {
        if (!t.pass_id) return null

        const passRes = await supabase
          .from('pass')
          .select('namn, datum, starttid, sluttid, sektion_id, maps_url, klader_utrustning, instruktion')
          .eq('id', t.pass_id)
          .single()

        const pass = passRes.data
        if (!pass) return null

        const [sektionInfoRes, slRes] = await Promise.all([
          supabase.from('sektioner').select('namn, farg, lat, lng').eq('id', pass.sektion_id).single(),
          supabase
            .from('profiles')
            .select('full_name, email')
            .eq('sektion_preferens', pass.sektion_id)
            .eq('role', 'sektionsledare')
            .maybeSingle(),
        ])

        return {
          pass_namn:            pass.namn,
          datum:                pass.datum ?? '2026-08-09',
          starttid:             pass.starttid,
          sluttid:              pass.sluttid,
          sektion_namn:         sektionInfoRes.data?.namn ?? 'Okänd sektion',
          sektion_farg:         sektionInfoRes.data?.farg ?? '#0066CC',
          sektionsledare_namn:  slRes.data?.full_name ?? null,
          sektionsledare_email: slRes.data?.email ?? null,
          maps_url:             pass.maps_url ?? null,
          klader_utrustning:    pass.klader_utrustning ?? null,
          instruktion:          pass.instruktion ?? null,
          lat:                  sektionInfoRes.data?.lat ?? null,
          lng:                  sektionInfoRes.data?.lng ?? null,
        } satisfies TilldelningInfo
      })
    )
  ).filter((t): t is TilldelningInfo => t !== null)
    .sort((a, b) => {
      // Sortera på datum, sedan starttid
      if (a.datum !== b.datum) return a.datum.localeCompare(b.datum)
      return a.starttid.localeCompare(b.starttid)
    })

  return (
    <FunktionarApp
      profil={profil}
      tilldelningar={tilldelningar}
      sektioner={sektionerRes.data ?? []}
      sektionVal={sektionValRes.data ?? []}
    />
  )
}
