import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Vercel Cron anropar denna rutt — skyddad med CRON_SECRET
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidPublic  = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:jonas@rylander.biz'

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID-nycklar saknas' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const supabase = await createClient()

  // Hitta pass som börjar om 25–35 minuter (fönster för 30-min-påminnelse)
  const nu       = new Date()
  const från     = new Date(nu.getTime() + 25 * 60 * 1000)
  const till     = new Date(nu.getTime() + 35 * 60 * 1000)
  const frånTid  = från.toTimeString().slice(0, 5)   // "HH:MM"
  const tillTid  = till.toTimeString().slice(0, 5)

  // Hämta pass som börjar inom tidsintervallet
  const { data: aktuellaPass } = await supabase
    .from('pass')
    .select('id, namn, starttid, sluttid, sektion_id, sektioner(namn)')
    .gte('starttid', frånTid)
    .lte('starttid', tillTid)

  if (!aktuellaPass || aktuellaPass.length === 0) {
    return NextResponse.json({ skickade: 0, meddelande: 'Inga pass att påminna om' })
  }

  const passIds = aktuellaPass.map(p => p.id)

  // Hämta tilldelningar för dessa pass
  const { data: tilldelningar } = await supabase
    .from('tilldelningar')
    .select('profil_id, pass_id')
    .in('pass_id', passIds)
    .eq('status', 'bekraftad')

  if (!tilldelningar || tilldelningar.length === 0) {
    return NextResponse.json({ skickade: 0, meddelande: 'Inga tilldelningar att påminna' })
  }

  // Hämta push-prenumerationer för berörda profiler
  const profilIds = [...new Set(tilldelningar.map(t => t.profil_id))]
  const { data: prenumerationer } = await supabase
    .from('push_subscriptions')
    .select('profil_id, endpoint, p256dh, auth')
    .in('profil_id', profilIds)

  if (!prenumerationer || prenumerationer.length === 0) {
    return NextResponse.json({ skickade: 0, meddelande: 'Inga push-prenumerationer' })
  }

  // Bygg lookup-maps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passMap      = new Map(aktuellaPass.map(p => [p.id, p as any]))
  const tilldelMap   = new Map(tilldelningar.map(t => [t.profil_id, t.pass_id]))

  let skickade = 0
  const felade: string[] = []

  for (const sub of prenumerationer) {
    const passId = tilldelMap.get(sub.profil_id)
    const pass   = passId ? passMap.get(passId) : null
    if (!pass) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sektionNamn = (pass.sektioner as any)?.namn ?? 'Okänd sektion'
    const payload = JSON.stringify({
      title: `⏰ Ditt pass börjar snart`,
      body:  `${sektionNamn} – ${pass.namn} kl. ${pass.starttid}`,
      tag:   `pass-${pass.id}`,
      url:   '/welcome',
    })

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      skickade++
    } catch (e: unknown) {
      const err = e as { statusCode?: number }
      if (err?.statusCode === 410) {
        // Prenumerationen är ogiltig — ta bort den
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        felade.push(sub.profil_id)
        console.error('[cron/reminders] push-fel:', e)
      }
    }
  }

  return NextResponse.json({ skickade, felade: felade.length })
}
