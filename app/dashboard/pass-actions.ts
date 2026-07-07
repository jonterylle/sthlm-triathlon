'use server'

import { createClient } from '@/lib/supabase/server'

async function verifieraTL() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile || profile.role !== 'tl') return null
  return { supabase, user }
}

// ── Skapa nytt pass ───────────────────────────────────────────
export async function skapaPass(data: {
  sektion_id: string
  namn: string
  datum: string
  starttid: string
  sluttid: string
  behovs_antal: number
  kompetenser?: string[]
  maps_url?: string | null
  klader_utrustning?: string | null
  instruktion?: string | null
}): Promise<{ ok: boolean; passId?: string; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }

  const { supabase } = ctx
  const { data: nytt, error } = await supabase
    .from('pass')
    .insert({
      sektion_id:   data.sektion_id,
      namn:         data.namn.trim().slice(0, 100),
      datum:        data.datum,
      starttid:     data.starttid,
      sluttid:      data.sluttid,
      behovs_antal: Math.max(1, Math.min(50, data.behovs_antal)),
      kompetenser:        data.kompetenser ?? [],
      maps_url:           data.maps_url?.trim() || null,
      klader_utrustning:  data.klader_utrustning?.trim() || null,
      instruktion:        data.instruktion?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[skapaPass]', error.message)
    return { ok: false, meddelande: 'Kunde inte skapa passet.' }
  }
  return { ok: true, passId: nytt.id }
}

// ── Uppdatera befintligt pass ─────────────────────────────────
export async function uppdateraPass(
  passId: string,
  data: {
    namn: string
    datum: string
    starttid: string
    sluttid: string
    behovs_antal: number
    kompetenser?: string[]
    maps_url?: string | null
    klader_utrustning?: string | null
    instruktion?: string | null
  }
): Promise<{ ok: boolean; meddelande?: string; tiderAndrades?: boolean }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  // Hämta nuvarande tider för att avgöra om mail ska skickas
  const { data: gammalt } = await supabase
    .from('pass')
    .select('namn, datum, starttid, sluttid, behovs_antal')
    .eq('id', passId)
    .single()

  const tiderAndrades =
    gammalt?.datum !== data.datum ||
    gammalt?.starttid !== data.starttid ||
    gammalt?.sluttid !== data.sluttid

  const { error } = await supabase
    .from('pass')
    .update({
      namn:         data.namn.trim().slice(0, 100),
      datum:        data.datum,
      starttid:     data.starttid,
      sluttid:      data.sluttid,
      behovs_antal: Math.max(1, Math.min(50, data.behovs_antal)),
      kompetenser:        data.kompetenser ?? [],
      maps_url:           data.maps_url?.trim() || null,
      klader_utrustning:  data.klader_utrustning?.trim() || null,
      instruktion:        data.instruktion?.trim() || null,
    })
    .eq('id', passId)

  if (error) {
    console.error('[uppdateraPass]', error.message)
    return { ok: false, meddelande: 'Kunde inte spara ändringen.' }
  }

  // Skicka mail till tilldelade funktionärer om tiderna ändrades
  if (tiderAndrades) {
    try {
      await skickaAndringsMail(supabase, passId, data)
    } catch (e) {
      console.error('[uppdateraPass] mail-fel:', e)
    }
  }

  return { ok: true, tiderAndrades }
}

// ── Ta bort pass ──────────────────────────────────────────────
export async function taBortPass(
  passId: string
): Promise<{ ok: boolean; meddelande?: string; harTilldelningar?: boolean }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  // Kontrollera aktiva tilldelningar
  const { count } = await supabase
    .from('tilldelningar')
    .select('id', { count: 'exact', head: true })
    .eq('pass_id', passId)
    .eq('status', 'bekraftad')

  if (count && count > 0) {
    return { ok: false, harTilldelningar: true, meddelande: `Passet har ${count} aktiva tilldelningar. Ta bort dem först.` }
  }

  const { error } = await supabase.from('pass').delete().eq('id', passId)
  if (error) {
    console.error('[taBortPass]', error.message)
    return { ok: false, meddelande: 'Kunde inte ta bort passet.' }
  }
  return { ok: true }
}

// ── Hjälp: skicka mail vid tidsändring ───────────────────────
async function skickaAndringsMail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  passId: string,
  nyaData: { namn: string; starttid: string; sluttid: string }
) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  // Hämta tilldelade funktionärer
  const { data: tilldelade } = await supabase
    .from('tilldelningar')
    .select('profil_id, profiles(full_name, email), pass(sektion_id, sektioner(namn))')
    .eq('pass_id', passId)
    .eq('status', 'bekraftad')

  if (!tilldelade || tilldelade.length === 0) return

  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sthlm-triathlon.vercel.app'
  const sektionNamn = tilldelade[0]?.pass?.sektioner?.namn ?? 'Okänd sektion'

  for (const t of tilldelade) {
    const email = t.profiles?.email
    const namn  = t.profiles?.full_name ?? email
    if (!email) continue

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#0066CC;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">STHLM <span style="color:#FF6B35">Triathlon</span> 2026</h1>
        </div>
        <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
          <p style="color:#111827">Hej ${namn}!</p>
          <p style="color:#374151">Tiderna för ett av dina pass har ändrats.</p>
          <div style="background:#fff7ed;border-left:4px solid #FF6B35;padding:16px;border-radius:4px;margin:20px 0">
            <p style="margin:0 0 8px;font-weight:600;color:#FF6B35">${sektionNamn}</p>
            <p style="margin:0 0 4px;color:#374151"><strong>Pass:</strong> ${nyaData.namn}</p>
            <p style="margin:0;color:#374151"><strong>Ny tid:</strong> ${nyaData.starttid} – ${nyaData.sluttid}</p>
          </div>
          <a href="${siteUrl}/welcome"
             style="display:inline-block;background:#0066CC;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Öppna funktionärsappen
          </a>
        </div>
      </div>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'STHLM Triathlon <noreply@funktionar.rylander.biz>',
        to:      [email],
        subject: `Ändrade tider: ${sektionNamn} – ${nyaData.namn}`,
        html,
      }),
    })
  }
}
