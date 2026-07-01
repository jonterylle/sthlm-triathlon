import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Supabase Auth callback — exchanges the auth code for a session,
 * kontrollerar vitlistan, och redirectar baserat på roll.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Validera 'next' mot open redirect
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  // Hämta profil för roll — TL/SL som redan finns i systemet
  // har en profil och behöver inte kontrolleras mot inbjudningar.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'funktionar'
  let effectiveRole = role

  // ── Vitlistningskontroll ────────────────────────────────────
  // TL och sektionsledare med befintlig profil är alltid tillåtna.
  // Funktionärer (inkl. nya användare utan profil) måste finnas
  // i inbjudningar-tabellen.
  if (role === 'funktionar') {
    const { data: inbjudan } = await supabase
      .from('inbjudningar')
      .select('id, roll')
      .eq('email', user.email ?? '')
      .maybeSingle()

    if (!inbjudan) {
      // Inte inbjuden — logga ut och visa felmeddelande
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=inte_inbjuden`)
    }

    // Uppdatera inbjudningsstatus till accepterad
    await supabase
      .from('inbjudningar')
      .update({ status: 'accepterad' })
      .eq('email', user.email ?? '')
      .eq('status', 'skickad')

    // Om inbjudan är för sektionsledare eller tl — uppdatera profilen
    if (inbjudan.roll === 'sektionsledare' || inbjudan.roll === 'tl') {
      const admin = createAdminClient()
      await admin.from('profiles').update({ role: inbjudan.roll }).eq('id', user.id)
      // Uppdatera lokala roll-variabeln så att redirect-destinationen stämmer
      effectiveRole = inbjudan.roll
    }
  }
  // ───────────────────────────────────────────────────────────

  const destination = effectiveRole === 'tl' || effectiveRole === 'sektionsledare'
    ? '/dashboard'
    : '/welcome'

  return NextResponse.redirect(
    next !== '/' ? `${origin}${next}` : `${origin}${destination}`
  )
}
