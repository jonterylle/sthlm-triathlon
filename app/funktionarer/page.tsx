import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'
import FunktionarerSida from '@/components/FunktionarerSida'
import type { Profile, SektionBemanningsgrad, SektionsledareInfo, TilldeladPerPass } from '@/lib/database.types'

export default async function FunktionarerPage() {
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

  const [funktionärerRes, sektionerRes, slRes, emailInbjRes, smsInbjRes, tilldeladeRes] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('sektion_bemanningsgrad').select('*').order('sortorder'),
    supabase.rpc('get_sektionsledare'),
    supabase.from('inbjudningar').select('id, email, skickad_at, status, roll').order('skickad_at', { ascending: false }),
    supabase.from('sms_inbjudningar').select('id, telefon, skickad_at, email_inkommen, status').order('skickad_at', { ascending: false }),
    supabase.rpc('get_tilldelade_per_pass'),
  ])

  const allaProfiler: Profile[]               = funktionärerRes.data ?? []
  const sektioner: SektionBemanningsgrad[]    = sektionerRes.data ?? []
  const sektionsledare: SektionsledareInfo[]  = slRes.data ?? []
  const emailInbjudningar                     = emailInbjRes.data ?? []
  const smsInbjudningar                       = smsInbjRes.data ?? []
  const tilldelade: TilldeladPerPass[]        = tilldeladeRes.data ?? []

  // TL ser alla, SL ser bara funktionärer (inga TL/SL-kollegor)
  const funktionärer = profile.role === 'tl'
    ? allaProfiler
    : allaProfiler.filter(f => f.role === 'funktionar')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader roleLabel={roleLabel} namn={profile.full_name ?? profile.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FunktionarerSida
          funktionärer={funktionärer}
          sektioner={sektioner}
          sektionsledare={sektionsledare}
          tilldelade={tilldelade}
          emailInbjudningar={emailInbjudningar}
          smsInbjudningar={smsInbjudningar}
          isTL={profile.role === 'tl'}
        />
      </main>
    </div>
  )
}
