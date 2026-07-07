import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

/**
 * POST /api/push/broadcast
 * Skickar en push-notis till ALLA funktionärer med aktiva prenumerationer.
 * Kräver inloggad TL.
 *
 * Body: { titel: string, meddelande: string }
 * Svar: { skickade: number, felade: number, inga_prenumerationer: boolean }
 */
export async function POST(request: NextRequest) {
  // ── Autentisering: bara TL får sända ────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })

  const { data: profil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profil?.role !== 'tl') {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
  }

  // ── Validera body ────────────────────────────────────────────
  let body: { titel?: string; meddelande?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Ogiltigt format' }, { status: 400 })
  }

  const titel     = (body.titel     ?? '').trim().slice(0, 100)
  const meddelande = (body.meddelande ?? '').trim().slice(0, 500)

  if (!titel || !meddelande) {
    return NextResponse.json({ error: 'Titel och meddelande krävs' }, { status: 400 })
  }

  // ── VAPID-konfiguration ──────────────────────────────────────
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:jonas@rylander.biz'

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID-nycklar saknas i miljökonfigurationen' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  // ── Hämta ALLA push-prenumerationer via admin-klient ─────────
  const admin = createAdminClient()
  const { data: prenumerationer } = await admin
    .from('push_subscriptions')
    .select('profil_id, endpoint, p256dh, auth')

  if (!prenumerationer || prenumerationer.length === 0) {
    return NextResponse.json({ skickade: 0, felade: 0, inga_prenumerationer: true })
  }

  // ── Skicka push till alla ────────────────────────────────────
  const payload = JSON.stringify({
    title: titel,
    body:  meddelande,
    tag:   `broadcast-${Date.now()}`,
    url:   '/welcome',
  })

  let skickade = 0
  let felade   = 0

  await Promise.all(prenumerationer.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      skickade++
    } catch (e: unknown) {
      const err = e as { statusCode?: number }
      if (err?.statusCode === 410) {
        // Utgången prenumeration — städa bort den
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        felade++
        console.error('[broadcast] push-fel för', sub.profil_id, e)
      }
    }
  }))

  return NextResponse.json({ skickade, felade, inga_prenumerationer: false })
}
