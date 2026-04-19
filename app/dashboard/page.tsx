import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DashboardTabs from '@/components/DashboardTabs'
import type {
  SektionBemanningsgrad,
  PassBemanningsgrad,
  OtilldeladFunktionar,
} from '@/lib/database.types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'tl' && profile.role !== 'sektionsledare')) {
    redirect('/welcome')
  }

  const [sektionerRes, passRes, otilldeladeRes] = await Promise.all([
    supabase.from('sektion_bemanningsgrad').select('*').order('sortorder'),
    supabase.from('pass_bemanningsgrad').select('*'),
    supabase.rpc('get_otilldelade_funktionarer'),
  ])

  const sektioner: SektionBemanningsgrad[] = sektionerRes.data ?? []
  const pass: PassBemanningsgrad[] = passRes.data ?? []
  const otilldelade: OtilldeladFunktionar[] = otilldeladeRes.data ?? []

  const totalBehövs = sektioner.reduce((s, x) => s + (x.behovs_totalt ?? 0), 0)
  const totalTilldelade = sektioner.reduce((s, x) => s + (x.tilldelade_totalt ?? 0), 0)
  const totalSaknas = totalBehövs - totalTilldelade
  const bemanningsgrad = totalBehövs > 0 ? Math.round((totalTilldelade / totalBehövs) * 100) : 0

  const roleLabel = profile.role === 'tl' ? 'Tävlingsledare' : 'Sektionsledare'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0066CC] flex items-center justify-center">
              <span className="text-white text-xs font-bold">ST</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                STHLM <span className="text-[#FF6B35]">Triathlon</span> 2026
              </h1>
              <p className="text-xs text-gray-500">9 aug · Stora Skuggan, Norra Djurgården</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs bg-blue-50 text-[#0066CC] px-2 py-1 rounded-full font-medium">
              {roleLabel}
            </span>
            <span className="text-sm text-gray-600 hidden sm:block">
              {profile.full_name ?? profile.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardTabs
          sektioner={sektioner}
          pass={pass}
          otilldelade={otilldelade}
          totalBehövs={totalBehövs}
          totalTilldelade={totalTilldelade}
          totalSaknas={totalSaknas}
          bemanningsgrad={bemanningsgrad}
        />
      </main>
    </div>
  )
}
