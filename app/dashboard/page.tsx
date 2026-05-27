import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'
import DashboardTabs from '@/components/DashboardTabs'
import SektionsledareApp from '@/components/SektionsledareApp'
import type {
  SektionBemanningsgrad,
  PassBemanningsgrad,
  FunktionarForTilldelning,
  PassMedSektion,
  TilldeladPerPass,
  MinSektionRad,
  SektionsledareInfo,
  SektionSL,
} from '@/lib/database.types'

export default async function DashboardPage() {
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

  // ── Sektionsledarvy ────────────────────────────────────────
  if (profile.role === 'sektionsledare') {
    const { data: minSektionData } = await supabase.rpc('get_min_sektion_data')
    const rader: MinSektionRad[] = minSektionData ?? []

    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader roleLabel={roleLabel} namn={profile.full_name ?? profile.email} />
        <main className="max-w-lg mx-auto px-4 py-6">
          <SektionsledareApp
            rader={rader}
            slNamn={profile.full_name ?? profile.email}
          />
        </main>
      </div>
    )
  }

  // ── TL-vy ──────────────────────────────────────────────────
  const [sektionerRes, passRes, funktionärerRes, passMedSektionerRes, tilldeladeRes, slRes, emailInbjRes, smsInbjRes, allaFunktionärerRes, sektionSLRes] = await Promise.all([
    supabase.from('sektion_bemanningsgrad').select('*').order('sortorder'),
    supabase.from('pass_bemanningsgrad').select('*'),
    supabase.rpc('get_funktionarer_for_tilldelning'),
    supabase.rpc('get_pass_med_sektioner'),
    supabase.rpc('get_tilldelade_per_pass'),
    supabase.rpc('get_sektionsledare'),
    supabase.from('inbjudningar').select('id, email, skickad_at, status, roll').order('skickad_at', { ascending: false }),
    supabase.from('sms_inbjudningar').select('id, telefon, skickad_at, email_inkommen, status').order('skickad_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('role', 'funktionar').order('full_name'),
    supabase.rpc('get_sektionsledare_per_sektion'),
  ])

  const sektioner: SektionBemanningsgrad[]         = sektionerRes.data ?? []
  const pass: PassBemanningsgrad[]                 = passRes.data ?? []
  const funktionärer: FunktionarForTilldelning[]   = funktionärerRes.data ?? []
  const passMedSektioner: PassMedSektion[]         = passMedSektionerRes.data ?? []
  const tilldeladePerPass: TilldeladPerPass[]      = tilldeladeRes.data ?? []
  const sektionsledare: SektionsledareInfo[]       = slRes.data ?? []
  const emailInbjudningar                          = emailInbjRes.data ?? []
  const smsInbjudningar                            = smsInbjRes.data ?? []
  const allaFunktionärer                           = allaFunktionärerRes.data ?? []
  const sektionSL: SektionSL[]                     = sektionSLRes.data ?? []

  void sektionsledare
  void emailInbjudningar
  void smsInbjudningar
  void allaFunktionärer

  const totalBehövs     = sektioner.reduce((s, x) => s + (x.behovs_totalt ?? 0), 0)
  const totalTilldelade = sektioner.reduce((s, x) => s + (x.tilldelade_totalt ?? 0), 0)
  const totalSaknas     = totalBehövs - totalTilldelade
  const bemanningsgrad  = totalBehövs > 0 ? Math.round((totalTilldelade / totalBehövs) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader roleLabel={roleLabel} namn={profile.full_name ?? profile.email} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardTabs
          sektioner={sektioner}
          pass={pass}
          passMedSektioner={passMedSektioner}
          tilldeladePerPass={tilldeladePerPass}
          funktionärer={funktionärer}
          sektionSL={sektionSL}
          totalBehövs={totalBehövs}
          totalTilldelade={totalTilldelade}
          totalSaknas={totalSaknas}
          bemanningsgrad={bemanningsgrad}
        />
      </main>
    </div>
  )
}
