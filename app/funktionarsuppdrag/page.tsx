import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'
import FunktionarsuppdragSida from '@/components/FunktionarsuppdragSida'
import type { PassMedSektion, TilldeladPerPass, FunktionarForTilldelning, SektionBemanningsgrad, SektionSL, SektionsledareInfo } from '@/lib/database.types'

export default async function FunktionarsuppdragPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'tl' && profile.role !== 'sektionsledare')) {
    return redirect('/welcome')
  }

  const roleLabel = profile.role === 'tl' ? 'Tävlingsledare' : 'Sektionsledare'

  const [passerRes, tilldeladeRes, funktionärerRes, sektionerRes, sektionSLRes, allaSLRes] = await Promise.all([
    supabase.rpc('get_pass_med_sektioner'),
    supabase.rpc('get_tilldelade_per_pass'),
    supabase.rpc('get_funktionarer_for_tilldelning'),
    supabase.from('sektion_bemanningsgrad').select('*').order('sortorder'),
    supabase.rpc('get_sektionsledare_per_sektion'),
    profile.role === 'tl'
      ? supabase.rpc('get_sektionsledare')
      : Promise.resolve({ data: [] }),
  ])

  const passer: PassMedSektion[]                 = passerRes.data ?? []
  const tilldelade: TilldeladPerPass[]            = tilldeladeRes.data ?? []
  const funktionärer: FunktionarForTilldelning[]  = funktionärerRes.data ?? []
  const sektioner: SektionBemanningsgrad[]        = sektionerRes.data ?? []
  const sektionSL: SektionSL[]                    = sektionSLRes.data ?? []
  const allaSL: SektionsledareInfo[]              = (allaSLRes.data ?? []) as SektionsledareInfo[]

  // SL: filtrera pass på de sektioner de ansvarar för (via nya tabellen)
  const filtreradePasser = profile.role === 'sektionsledare'
    ? passer.filter(p => sektionSL.some(sl => sl.sektion_id === p.sektion_id && sl.profil_id === user.id))
    : passer

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader roleLabel={roleLabel} namn={profile.full_name ?? profile.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FunktionarsuppdragSida
          passer={filtreradePasser}
          tilldelade={tilldelade}
          funktionärer={funktionärer}
          sektioner={sektioner}
          sektionSL={sektionSL}
          allaSL={allaSL}
          isTL={profile.role === 'tl'}
        />
      </main>
    </div>
  )
}
