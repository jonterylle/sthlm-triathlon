'use server'

import { createClient } from '@/lib/supabase/server'

export type TilldelningResultat = {
  ok: boolean
  meddelande?: string
}

// ── Tilldela funktionär till pass ─────────────────────────────
export async function tilldelaFunktionar(
  profilId: string,
  passId: string,
  notering?: string
): Promise<TilldelningResultat> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, meddelande: 'Inte inloggad' }

  const { data: tlProfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!tlProfil || tlProfil.role !== 'tl') {
    return { ok: false, meddelande: 'Behörighet saknas' }
  }

  // Sätt in tilldelning
  const { error } = await supabase
    .from('tilldelningar')
    .insert({
      profil_id:   profilId,
      pass_id:     passId,
      status:      'bekraftad',
      notering:    notering?.trim() || null,
      tilldelad_av: user.id,
    })

  if (error) {
    console.error('[tilldelaFunktionar] insert error:', error.message, error.code)
    if (error.code === '23505') {
      return { ok: false, meddelande: 'Funktionären är redan tilldelad detta pass.' }
    }
    return { ok: false, meddelande: 'Kunde inte spara tilldelningen. Försök igen.' }
  }

  // Skicka bekräftelsemail (best-effort — fel blockerar inte tilldelningen)
  try {
    await skickabekraftelsemail(supabase, profilId, passId)
  } catch (e) {
    console.error('[tilldelaFunktionar] email-fel:', e)
  }

  return { ok: true }
}

// ── Ta bort tilldelning ───────────────────────────────────────
export async function taBortTilldelning(
  tilldelningId: string
): Promise<TilldelningResultat> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, meddelande: 'Inte inloggad' }

  const { data: tlProfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!tlProfil || tlProfil.role !== 'tl') {
    return { ok: false, meddelande: 'Behörighet saknas' }
  }

  const { error } = await supabase
    .from('tilldelningar')
    .delete()
    .eq('id', tilldelningId)

  if (error) {
    console.error('[taBortTilldelning] delete error:', error.message)
    return { ok: false, meddelande: 'Kunde inte ta bort tilldelningen. Försök igen.' }
  }

  return { ok: true }
}

// ── Hjälpfunktion: skicka bekräftelsemail via Resend ─────────
async function skickabekraftelsemail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profilId: string,
  passId: string
) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[bekraftelsemail] RESEND_API_KEY saknas — hoppar över mail')
    return
  }

  // Hämta funktionärsinfo och passinfo parallellt
  const [profilRes, passRes] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', profilId).single(),
    supabase
      .from('pass')
      .select('namn, starttid, sluttid, sektion_id, sektioner(namn)')
      .eq('id', passId)
      .single(),
  ])

  const profil = profilRes.data
  const pass   = passRes.data

  if (!profil?.email || !pass) return

  const sektionNamn = pass.sektioner?.namn ?? 'Okänd sektion'
  const namn        = profil.full_name ?? profil.email
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sthlm-triathlon.vercel.app'

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#0066CC;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">STHLM <span style="color:#FF6B35">Triathlon</span> 2026</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">9 augusti · Stora Skuggan, Norra Djurgården</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
        <p style="color:#111827;font-size:16px">Hej ${namn}!</p>
        <p style="color:#374151">Du har tilldelats ett pass som funktionär på STHLM Triathlon 2026.</p>
        <div style="background:#f0f7ff;border-left:4px solid #0066CC;padding:16px;border-radius:4px;margin:20px 0">
          <p style="margin:0 0 8px;font-weight:600;color:#0066CC">${sektionNamn}</p>
          <p style="margin:0 0 4px;color:#374151"><strong>Pass:</strong> ${pass.namn}</p>
          <p style="margin:0;color:#374151"><strong>Tid:</strong> ${pass.starttid} – ${pass.sluttid}</p>
        </div>
        <p style="color:#374151">Logga in i funktionärsappen för mer information och för att se dina uppgifter.</p>
        <a href="${siteUrl}/welcome"
           style="display:inline-block;background:#0066CC;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
          Öppna funktionärsappen
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">
          Frågor? Kontakta tävlingsledningen på <a href="mailto:jonas@rylander.biz" style="color:#0066CC">jonas@rylander.biz</a>
        </p>
      </div>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'STHLM Triathlon <noreply@funktionar.rylander.biz>',
      to:      [profil.email],
      subject: `Du är tilldelad: ${sektionNamn} – ${pass.namn}`,
      html,
    }),
  })
}
