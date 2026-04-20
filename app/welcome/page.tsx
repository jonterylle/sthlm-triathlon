import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ registrerad?: string }>
}

const passPreferensLabel: Record<string, string> = {
  forberedelse:    'Förberedelse (06:00–08:00)',
  tavling:         'Tävlingspass (08:00–14:00)',
  heldagen:        'Hela dagen (06:00–16:00)',
  ingen_preferens: 'Ingen preferens',
}

export default async function WelcomePage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, telefon, klubb, pass_preferens, kompetenser, erfarenhet, specialkost, registrerad_at, sektion_preferens')
    .eq('id', user.id)
    .single()

  if (!profile) return redirect('/login')
  if (profile.role === 'tl' || profile.role === 'sektionsledare') return redirect('/dashboard')

  // Hämta sektionspreferensens namn om satt
  let sektionNamn: string | null = null
  if (profile.sektion_preferens) {
    const { data: s } = await supabase
      .from('sektioner')
      .select('namn')
      .eq('id', profile.sektion_preferens)
      .single()
    sektionNamn = s?.namn ?? null
  }

  const params = await searchParams
  const nyssBekraftad = params.registrerad === '1'
  const arRegistrerad = !!profile.registrerad_at
  const namn = profile.full_name ?? profile.email ?? 'Funktionär'
  const kompetenser: string[] = profile.kompetenser ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0066CC] flex items-center justify-center">
              <span className="text-white text-xs font-bold">ST</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              STHLM <span className="text-[#FF6B35]">Triathlon</span> 2026
            </h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Bekräftelsebanner */}
        {nyssBekraftad && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <span>✅</span>
            <span>Din registrering är sparad — tack!</span>
          </div>
        )}

        {/* Uppmaning att registrera sig om inte gjort */}
        {!arRegistrerad && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl">📋</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Du har inte registrerat dig ännu</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Fyll i dina uppgifter så att tävlingsledningen kan planera bemanningen.
              </p>
              <Link
                href="/registrera"
                className="inline-block mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Registrera dig nu
              </Link>
            </div>
          </div>
        )}

        {/* Välkomstkortet */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🏅</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Välkommen, {namn}!</h2>
              <p className="text-xs text-gray-500">Funktionär · STHLM Triathlon 2026</p>
            </div>
          </div>

          <dl className="space-y-2 text-sm border-t border-gray-100 pt-4">
            <div className="flex justify-between">
              <dt className="text-gray-500">Datum</dt>
              <dd className="font-medium">9 augusti 2026</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Plats</dt>
              <dd className="font-medium">Stora Skuggan, Norra Djurgården</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Ditt pass</dt>
              <dd className="text-gray-400 italic">Meddelas av TL</dd>
            </div>
          </dl>
        </div>

        {/* Din registrering */}
        {arRegistrerad && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Din registrering</h3>
              <Link href="/registrera" className="text-xs text-[#0066CC] hover:underline">
                Redigera
              </Link>
            </div>
            <dl className="space-y-2 text-sm">
              {profile.telefon && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Telefon</dt>
                  <dd>{profile.telefon}</dd>
                </div>
              )}
              {profile.klubb && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Klubb</dt>
                  <dd>{profile.klubb}</dd>
                </div>
              )}
              {sektionNamn && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Sektionspreferens</dt>
                  <dd>{sektionNamn}</dd>
                </div>
              )}
              {profile.pass_preferens && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Passpreferens</dt>
                  <dd>{passPreferensLabel[profile.pass_preferens] ?? profile.pass_preferens}</dd>
                </div>
              )}
              {kompetenser.length > 0 && (
                <div className="flex justify-between items-start">
                  <dt className="text-gray-500">Kompetenser</dt>
                  <dd className="text-right">{kompetenser.join(', ')}</dd>
                </div>
              )}
              {profile.specialkost && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Specialkost</dt>
                  <dd>{profile.specialkost}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-2">
          Frågor? Kontakta din sektionsledare eller tävlingsledningen.
        </p>
      </main>
    </div>
  )
}
