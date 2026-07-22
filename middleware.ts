import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Supabase session refresh middleware.
 *
 * Supabase sessions are JWT-based and expire. Without this middleware,
 * a server component might receive an expired access token and redirect
 * to /login even though the refresh token is still valid — creating a
 * redirect loop. The middleware calls getUser() on every page request,
 * which triggers an automatic token refresh if needed and attaches the
 * updated cookies to the response BEFORE the page renders.
 *
 * Note: No redirect logic here — page components own that. This middleware
 * only ensures the session state is fresh before any server component runs.
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
          // Update the mutable request copy so downstream reads are consistent
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Rebuild the response to carry the refreshed cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add code between createServerClient and getUser().
  // A simple mistake here could make it hard to debug session issues.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run on all routes except:
     * - Next.js internals (_next/static, _next/image)
     * - favicon and static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
