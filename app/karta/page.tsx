import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'
import AdminKarta from '@/components/AdminKarta'
import type { PassForKarta } from '@/lib/database.types'

export default async function KartaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name, email').eq('id', user.id).single()

  if (!profile || (profile.role !== 'tl' && profile.role !== 'sektionsledare')) {
    return redirect('/welcome')
  }

  const roleLabel = profile.role === 'tl' ? 'Tävlingsledare' : 'Sektionsledare'

  // Hämta alla pass med koordinater via RPC
  const { data: allePass } = await supabase.rpc('get_alle_pass_for_karta')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader roleLabel={roleLabel} namn={profile.full_name ?? profile.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Karta</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tävlingsområdet Stora Skuggan · 9 augusti 2026
          </p>
        </div>
        <AdminKarta allePass={(allePass ?? []) as PassForKarta[]} />
      </main>
    </div>
  )
}
