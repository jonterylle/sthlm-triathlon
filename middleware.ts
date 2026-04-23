import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js Middleware — körs på edge-runtime före varje request.
 *
 * Ansvar:
 *  1. Refreshar Supabase-sessionen (roterar access token vid behov)
 *  2. Vidarebefordrar uppdaterade cookies till både request och response
 *
 * Middleware gör INTE hard-redirect för ej inloggade — det hanterar varje
 * page/route individuellt. Middleware:s uppgift är bara att hålla sessionen
 * fräsch så att server-komponenter alltid ser rätt auth-state.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // VIKTIGT: getUser() triggar session-refresh och verifierar JWT mot Supabase Auth.
  // Ignorera resultatet — varje sida gör sin egen auth-kontroll.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}