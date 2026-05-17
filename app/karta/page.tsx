import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader roleLabel={roleLabel} namn={profile.full_name ?? profile.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="text-6xl">🗺️</div>
          <h1 className="text-2xl font-bold text-gray-900">Karta</h1>
          <p className="text-gray-500 max-w-sm">
            Kartfunktionen är under uppbyggnad och kommer snart. Här visas tävlingsområdet med
            sektionernas positioner och bemanningsstatus.
          </p>
          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-full font-medium">
            Kommer snart
          </span>
        </div>
      </main>
    </div>
  )
}
