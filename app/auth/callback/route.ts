import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Supabase Auth callback — exchanges the auth code for a session,
 * kontrollerar vitlistan, och redirectar baserat på roll.
 *
 * Viktigt: Vi fångar upp de cookies som Supabase vill sätta och
 * bifogar dem direkt på redirect-svaret (Set-Cookie på 302-svaret).
 * Utan detta tappar Safari (och ibland Chrome) session-cookiesen
 * i redirect-kedjan och hamnar i en "too many redirects"-loop:
 *   /auth/callback → /welcome (ingen cookie) → /login → om igen
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

  // Samla cookies som Supabase vill sätta.
  // Vi sätter dem på redirect-svaret nedan — inte via cookies() från
  // next/headers — för att garantera att de finns på 302-svaret.
  type CookieEntry = { name: string; value: string; options?: Record<string, unknown> }
  const cookieJar: CookieEntry[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Läs från inkommande request-cookies
        getAll: () => request.cookies.getAll(),
        setAll: (cs: CookieEntry[]) => {
          // Uppdatera request-cookies så att getUser() nedan ser dem
          cs.forEach(({ name, value }) => request.cookies.set(name, value))
          // Spara för att bifoga på redirect-svaret
          cookieJar.push(...cs)
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
  // Admin-klienten används för att kringgå RLS på inbjudningar
  // (tabellen är annars bara läsbar av TL).
  if (role === 'funktionar') {
    const admin = createAdminClient()

    const { data: inbjudan } = await admin
      .from('inbjudningar')
      .select('id, roll')
      .eq('email', user.email ?? '')
      .maybeSingle()

    if (!inbjudan) {
      // Inte inbjuden — logga ut och visa felmeddelande
      await supabase.auth.signOut()
      const errResponse = NextResponse.redirect(`${origin}/login?error=inte_inbjuden`)
      cookieJar.forEach(({ name, value, options }) =>
        errResponse.cookies.set(name, value, options ?? {})
      )
      return errResponse
    }

    // Uppdatera inbjudningsstatus till accepterad
    await admin
      .from('inbjudningar')
      .update({ status: 'accepterad' })
      .eq('email', user.email ?? '')
      .eq('status', 'skickad')

    // Om inbjudan är för sektionsledare eller tl — uppdatera profilen
    if (inbjudan.roll === 'sektionsledare' || inbjudan.roll === 'tl') {
      await admin.from('profiles').update({ role: inbjudan.roll }).eq('id', user.id)
      effectiveRole = inbjudan.roll
    }
  }
  // ───────────────────────────────────────────────────────────

  // ── Bygg redirect-svar med session-cookies bifogade ─────────
  const destination = effectiveRole === 'tl' || effectiveRole === 'sektionsledare'
    ? '/dashboard'
    : '/welcome'

  const redirectUrl = next !== '/' ? `${origin}${next}` : `${origin}${destination}`
  const response = NextResponse.redirect(redirectUrl)

  // Bifoga session-cookies på 302-svaret — avgörande för Safari.
  // Utan detta skickas Set-Cookie på ett separat "implicit" svar
  // och försvinner innan webbläsaren följer redirecten.
  cookieJar.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options ?? {})
  })

  return response
}
