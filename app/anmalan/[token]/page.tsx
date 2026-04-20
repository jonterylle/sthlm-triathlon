import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ token: string }>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function sparaEmail(token: string, formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return redirect(`/anmalan/${token}?error=ogiltig_email`)

  const supabase = await createClient()

  // Använd SECURITY DEFINER-funktion som atomiskt validerar token,
  // kontrollerar expiry och uppdaterar email_inkommen.
  // Undviker race condition och kräver ingen anon SELECT-policy.
  const { data: resultat, error } = await supabase
    .rpc('registrera_email_for_sms_inbjudan', {
      p_token: token,
      p_email: email,
    })

  if (error) return redirect(`/anmalan/${token}?error=spara_misslyckades`)

  if (resultat === 'ogiltig_token') return redirect('/anmalan/ogiltig')
  if (resultat === 'utgangen')      return redirect('/anmalan/ogiltig')
  if (resultat === 'redan_registrerad') return redirect(`/anmalan/${token}?already=1`)

  return redirect(`/anmalan/${token}?klar=1`)
}

export default async function AnmalanPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // Använd SECURITY DEFINER-funktion — exponerar bara nödvändiga kolumner
  // och kontrollerar att token inte löpt ut. Anon kan INTE läsa hela tabellen.
  const { data: rader } = await supabase
    .rpc('hamta_sms_inbjudan', { p_token: token })

  const rad = rader?.[0] ?? null

  // Ogiltig token
  if (!rad) {
    return (
      <Skal>
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Ogiltig länk</h2>
          <p className="text-sm text-gray-500">Den här inbjudningslänken är inte giltig. Kontakta tävlingsledningen.</p>
        </div>
      </Skal>
    )
  }

  // Redan inskickad
  if (rad.email_inkommen) {
    return (
      <Skal>
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Tack!</h2>
          <p className="text-sm text-gray-500">
            Din e-post <strong>{rad.email_inkommen}</strong> är registrerad.
            Du får en inbjudan via e-post inom kort.
          </p>
        </div>
      </Skal>
    )
  }

  const sparaEmailMedToken = sparaEmail.bind(null, token)

  return (
    <Skal>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Du är inbjuden!</h2>
      <p className="text-sm text-gray-500 mb-6">
        Ange din e-postadress så skickar tävlingsledningen en inbjudan till dig.
      </p>

      <form action={sparaEmailMedToken} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Din e-postadress
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="din@epost.se"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-[#0066CC] hover:bg-[#0052a3] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
        >
          Skicka
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-400 text-center">
        STHLM Triathlon 2026 · 9 aug · Stora Skuggan
      </p>
    </Skal>
  )
}

function Skal({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            STHLM <span className="text-[#FF6B35]">Triathlon</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Funktionärsanmälan</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
