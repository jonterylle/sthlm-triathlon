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

  // ── Vitlistningskontroll ────────────────────────────────────
  // Kontrollera att e-posten finns i inbjudningar INNAN vi läser profilen.
  // Triggern handle_new_user skapar bara profil för inbjudna, men detta
  // är ett extra lager: skyddar även mot race conditions.
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

  // Hämta profil — kan saknas om triggern missade att skapa den
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let role = profile?.role ?? inbjudan.roll ?? 'funktionar'

  // Om profil saknas (edge case) — skapa den nu via admin-klient
  if (!profile) {
    const admin = createAdminClient()
    const nyRoll = (inbjudan.roll === 'tl' || inbjudan.roll === 'sektionsledare')
      ? inbjudan.roll
      : 'funktionar' as const
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('profiles') as any).insert({
      id:    user.id,
      email: user.email!,
      role:  nyRoll,
    })
    role = nyRoll
  }

  // Sätt rätt roll om inbjudan anger en privilegierad roll
  if (inbjudan.roll === 'sektionsledare' || inbjudan.roll === 'tl') {
    if (role !== inbjudan.roll) {
      const admin = createAdminClient()
      await admin.from('profiles').update({ role: inbjudan.roll }).eq('id', user.id)
    }
    role = inbjudan.roll
  }
  // ───────────────────────────────────────────────────────────

  const destination = role === 'tl' || role === 'sektionsledare'
    ? '/dashboard'
    : '/welcome'

  return NextResponse.redirect(
    next !== '/' ? `${origin}${next}` : `${origin}${destination}`
  )
}
