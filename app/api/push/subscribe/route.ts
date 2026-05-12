import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })

  let body: { endpoint: string; keys: { p256dh: string; auth: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltigt format' }, { status: 400 })
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'Saknade fält' }, { status: 400 })
  }

  // Upsert — samma endpoint ersätter gammal prenumeration
  const { error } = await supabase.from('push_subscriptions').upsert({
    profil_id: user.id,
    endpoint:  body.endpoint.slice(0, 500),
    p256dh:    body.keys.p256dh,
    auth:      body.keys.auth,
  }, { onConflict: 'profil_id,endpoint' })

  if (error) {
    console.error('[push/subscribe]', error.message)
    return NextResponse.json({ error: 'Databasfel' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })

  let body: { endpoint: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Ogiltigt format' }, { status: 400 })
  }

  await supabase.from('push_subscriptions')
    .delete()
    .eq('profil_id', user.id)
    .eq('endpoint', body.endpoint)

  return NextResponse.json({ ok: true })
}
