import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sparaRegistrering } from './actions'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function RegistreraPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, telefon, klubb, sektion_preferens, pass_preferens, erfarenhet, specialkost, kompetenser, registrerad_at')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'funktionar' && profile.role !== 'sektionsledare')) {
    redirect('/dashboard')
  }

  // Hämta sektioner för dropdown
  const { data: sektioner } = await supabase
    .from('sektioner')
    .select('id, namn')
    .order('sortorder')

  const params = await searchParams
  const felmeddelande =
    params.error === 'namn_saknas'       ? 'Du måste ange ditt namn.' :
    params.error === 'spara_misslyckades' ? 'Något gick fel. Försök igen.' :
    null

  const kompetenser: string[] = profile.kompetenser ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0066CC] flex items-center justify-center">
            <span className="text-white text-xs font-bold">ST</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              STHLM <span className="text-[#FF6B35]">Triathlon</span> 2026
            </h1>
            <p className="text-xs text-gray-500">Funktionärsregistrering</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Registrera dig som funktionär</h2>
          <p className="text-sm text-gray-500 mb-6">
            Fyll i dina uppgifter så att tävlingsledningen kan planera bemanningen.
            Fält markerade med * är obligatoriska.
          </p>

          {felmeddelande && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {felmeddelande}
            </div>
          )}

          <form action={sparaRegistrering} className="space-y-6">

            {/* Personuppgifter */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100 w-full">
                Personuppgifter
              </legend>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn *
                </label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={profile.full_name ?? ''}
                  required
                  placeholder="För- och efternamn"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-post
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">E-posten är kopplad till ditt konto och kan inte ändras här.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  name="telefon"
                  defaultValue={profile.telefon ?? ''}
                  placeholder="07X-XXX XX XX"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Klubbtillhörighet
                </label>
                <input
                  type="text"
                  name="klubb"
                  defaultValue={profile.klubb ?? ''}
                  placeholder="T.ex. Stockholms Triallsällskap"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                />
              </div>
            </fieldset>

            {/* Preferenser */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100 w-full">
                Preferenser
              </legend>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Önskad sektion
                </label>
                <select
                  name="sektion_preferens"
                  defaultValue={profile.sektion_preferens ?? ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent bg-white"
                >
                  <option value="">Ingen preferens</option>
                  {(sektioner ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.namn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Önskat pass
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'forberedelse', label: 'Förberedelse', sub: 'ca 06:00–08:00' },
                    { value: 'tavling',      label: 'Tävlingspass', sub: 'ca 08:00–14:00' },
                    { value: 'heldagen',     label: 'Hela dagen',   sub: 'ca 06:00–16:00' },
                    { value: 'ingen_preferens', label: 'Ingen preferens', sub: '' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="pass_preferens"
                        value={opt.value}
                        defaultChecked={
                          profile.pass_preferens === opt.value ||
                          (!profile.pass_preferens && opt.value === 'ingen_preferens')
                        }
                        className="text-[#0066CC] focus:ring-[#0066CC]"
                      />
                      <span className="text-sm text-gray-700">
                        {opt.label}
                        {opt.sub && <span className="text-gray-400 ml-1">({opt.sub})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Kompetenser */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100 w-full">
                Kompetenser
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { value: 'sjukvard',           label: 'Sjukvård / HLR' },
                  { value: 'korkort',             label: 'Körkort' },
                  { value: 'triathlon_erfarenhet', label: 'Triathlonerfarenhet' },
                  { value: 'simning',             label: 'Simkunnig / livräddning' },
                  { value: 'cykel_teknik',        label: 'Cykelmekanik' },
                  { value: 'engelska',            label: 'Engelska (muntlig)' },
                ].map((k) => (
                  <label key={k.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="kompetenser"
                      value={k.value}
                      defaultChecked={kompetenser.includes(k.value)}
                      className="rounded text-[#0066CC] focus:ring-[#0066CC]"
                    />
                    <span className="text-sm text-gray-700">{k.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Övrig info */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100 w-full">
                Övrigt
              </legend>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Erfarenhet och noter
                </label>
                <textarea
                  name="erfarenhet"
                  defaultValue={profile.erfarenhet ?? ''}
                  rows={3}
                  placeholder="Berätta gärna om tidigare erfarenhet av tävlingsarrangemang, ledarroller eller annat relevant."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specialkost / allergier
                </label>
                <input
                  type="text"
                  name="specialkost"
                  defaultValue={profile.specialkost ?? ''}
                  placeholder="T.ex. vegetarian, glutenfri, nötallerg"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                />
              </div>
            </fieldset>

            <button
              type="submit"
              className="w-full bg-[#0066CC] hover:bg-[#0052a3] text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
            >
              Spara registrering
            </button>

          </form>
        </div>
      </main>
    </div>
  )
}
