'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFON_RE = /^\+?[0-9\s\-]{7,15}$/

export type InbjudanResultat = {
  email: string
  status: 'skickad' | 'redan_inbjuden' | 'redan_registrerad' | 'fel'
  meddelande?: string
}

export type SMSResultat = {
  telefon: string
  status: 'skickad' | 'redan_inbjuden' | 'fel'
  meddelande?: string
}

// ── Kontrollera att anroparen är TL ──────────────────────────
async function verifieraTL() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'tl') return null
  return { supabase, user, profile }
}

// ── Skicka e-postinbjudningar ─────────────────────────────────
export async function bjudIn(
  formData: FormData
): Promise<{ resultat: InbjudanResultat[] }> {
  const ctx = await verifieraTL()
  if (!ctx) return { resultat: [] }
  const { supabase, user } = ctx

  const raw = String(formData.get('emails') ?? '')
  const emails = raw
    .split(/[\n,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e))
    .slice(0, 50)

  if (emails.length === 0) return { resultat: [] }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const redirectTo = `${siteUrl}/auth/callback?next=/welcome`
  const resultat: InbjudanResultat[] = []

  for (const email of emails) {
    // Redan inbjuden?
    const { data: befintlig } = await supabase
      .from('inbjudningar')
      .select('status')
      .eq('email', email)
      .single()

    if (befintlig) {
      resultat.push({ email, status: 'redan_inbjuden' })
      continue
    }

    // Redan registrerad?
    const { data: befintligProfil } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (befintligProfil) {
      resultat.push({ email, status: 'redan_registrerad' })
      continue
    }

    // Skicka inbjudan
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })

    if (error) {
      console.error(`[bjudIn] fel för ${email}:`, error.message)
      await supabase.from('inbjudningar').insert({
        email, skickad_av: user.id, status: 'fel', felmeddelande: error.message,
      })
      // Returnera generiskt fel till klienten — logga detaljer server-side
      resultat.push({ email, status: 'fel', meddelande: 'Kunde inte skicka inbjudan. Försök igen.' })
      continue
    }

    await supabase.from('inbjudningar').insert({
      email, skickad_av: user.id, status: 'skickad',
    })
    resultat.push({ email, status: 'skickad' })
  }

  return { resultat }
}

// ── Skicka SMS-inbjudningar via 46elks ────────────────────────
export async function skickaSMSInbjudan(
  formData: FormData
): Promise<{ resultat: SMSResultat[] }> {
  const ctx = await verifieraTL()
  if (!ctx) return { resultat: [] }
  const { supabase, user } = ctx

  const raw = String(formData.get('telefonnummer') ?? '')
  const nummer = raw
    .split(/[\n,]+/)
    .map((t) => t.trim().replace(/\s/g, ''))
    .filter((t) => TELEFON_RE.test(t))
    .slice(0, 20)

  if (nummer.length === 0) return { resultat: [] }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const elksUser = process.env.ELKS_API_USERNAME
  const elksPass = process.env.ELKS_API_PASSWORD

  if (!elksUser || !elksPass) {
    console.error('[skickaSMS] 46elks-uppgifter saknas')
    return { resultat: nummer.map((t) => ({ telefon: t, status: 'fel', meddelande: '46elks ej konfigurerat' })) }
  }

  const resultat: SMSResultat[] = []

  for (const telefon of nummer) {
    // Normalisera till internationellt format (svenska nummer)
    const normaliseradTelefon = telefon.startsWith('0')
      ? '+46' + telefon.slice(1)
      : telefon

    // Redan inbjuden via SMS?
    const { data: befintlig } = await supabase
      .from('sms_inbjudningar')
      .select('id')
      .eq('telefon', normaliseradTelefon)
      .single()

    if (befintlig) {
      resultat.push({ telefon, status: 'redan_inbjuden' })
      continue
    }

    // Skapa token och spara i databasen
    const { data: smsRad, error: dbError } = await supabase
      .from('sms_inbjudningar')
      .insert({ telefon: normaliseradTelefon, skickad_av: user.id })
      .select('token')
      .single()

    if (dbError || !smsRad) {
      resultat.push({ telefon, status: 'fel', meddelande: 'Databasfel' })
      continue
    }

    const anmalanUrl = `${siteUrl}/anmalan/${smsRad.token}`
    const meddelande = `Hej! Du är inbjuden som funktionär till STHLM Triathlon 2026. Anmäl dig här: ${anmalanUrl}`

    // Skicka SMS via 46elks
    const auth = Buffer.from(`${elksUser}:${elksPass}`).toString('base64')
    const smsRes = await fetch('https://api.46elks.com/a1/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: 'STHLMTriath',
        to: normaliseradTelefon,
        message: meddelande,
      }).toString(),
    })

    if (!smsRes.ok) {
      const felText = await smsRes.text()
      console.error(`[skickaSMS] 46elks fel för ${telefon}:`, felText)
      await supabase.from('sms_inbjudningar')
        .delete()
        .eq('token', smsRad.token)
      resultat.push({ telefon, status: 'fel', meddelande: '46elks svarade med fel' })
      continue
    }

    resultat.push({ telefon, status: 'skickad' })
  }

  return { resultat }
}

// ── Skicka e-postinbjudan till inkommen SMS-e-post ────────────
export async function bjudInFranSMS(smsId: string): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false }
  const { supabase, user } = ctx

  const { data: smsRad } = await supabase
    .from('sms_inbjudningar')
    .select('email_inkommen, status')
    .eq('id', smsId)
    .single()

  if (!smsRad?.email_inkommen) return { ok: false, meddelande: 'Ingen e-post inkommen' }
  if (smsRad.status === 'inbjudan_skickad') return { ok: false, meddelande: 'Inbjudan redan skickad' }

  const email = smsRad.email_inkommen
  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // Skapa inbjudningsrad
  await supabase.from('inbjudningar').upsert({
    email, skickad_av: user.id, status: 'skickad',
  })

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/welcome`,
  })

  if (error) {
    console.error('[bjudInFranSMS] inviteUserByEmail fel:', error.message)
    return { ok: false, meddelande: 'Kunde inte skicka inbjudan. Försök igen.' }
  }

  await supabase.from('sms_inbjudningar')
    .update({ status: 'inbjudan_skickad' })
    .eq('id', smsId)

  return { ok: true }
}
