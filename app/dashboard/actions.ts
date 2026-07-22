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
  const rawRoll = String(formData.get('roll') ?? 'funktionar')
  const roll: 'funktionar' | 'sektionsledare' | 'tl' =
    rawRoll === 'sektionsledare' ? 'sektionsledare'
    : rawRoll === 'tl' ? 'tl'
    : 'funktionar'

  const emails = raw
    .split(/[\n,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e))
    .slice(0, 50)

  if (emails.length === 0) return { resultat: [] }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  // Inbjudningar använder implicit flow (hash-tokens, inte PKCE-kod) —
  // redirectTo måste peka på en klientsida som kan läsa URL-fragmentet.
  const redirectTo = `${siteUrl}/login`
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

    // ── INSERT inbjudningar FÖRST ────────────────────────────
    // handle_new_user-triggern (migration 022) kontrollerar att e-posten
    // finns i inbjudningar innan den skapar en profil.
    // Om vi skickar inbjudan (inviteUserByEmail) innan raden är infogad
    // hinner triggern inte hitta e-posten → ingen profil skapas.
    const { data: nyInbjudan, error: insertError } = await supabase
      .from('inbjudningar')
      .insert({ email, skickad_av: user.id, status: 'skickad', roll })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[bjudIn] INSERT fel för ${email}:`, insertError.message, insertError.code)
      resultat.push({ email, status: 'fel', meddelande: 'Kunde inte registrera inbjudan. Försök igen.' })
      continue
    }

    // ── Skicka inbjudan via Supabase Auth ────────────────────
    // auth.users INSERT → handle_new_user-triggern hittar nu e-posten
    // i inbjudningar och skapar en profil direkt.
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })

    if (error) {
      console.error(`[bjudIn] fel för ${email}:`, error.message)
      // Markera inbjudan som misslyckad (raden finns redan)
      await supabase.from('inbjudningar').update({
        status: 'fel', felmeddelande: error.message,
      }).eq('id', nyInbjudan.id)
      // Returnera generiskt fel till klienten — logga detaljer server-side
      resultat.push({ email, status: 'fel', meddelande: 'Kunde inte skicka inbjudan. Försök igen.' })
      continue
    }

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

  // Skapa inbjudningsrad (SMS-inbjudningar är alltid funktionärer)
  await supabase.from('inbjudningar').upsert({
    email, skickad_av: user.id, status: 'skickad', roll: 'funktionar',
  })

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/login`,
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

// ── Skicka om e-postinbjudan ──────────────────────────────────
export async function skickaOmInbjudan(
  inbjudanId: string,
  email: string,
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/login`,
  })

  if (error) {
    console.error('[skickaOmInbjudan] fel:', error.message)
    return { ok: false, meddelande: 'Kunde inte skicka om inbjudan. Försök igen.' }
  }

  // Återställ status till 'skickad' om det tidigare var 'fel'
  await supabase
    .from('inbjudningar')
    .update({ status: 'skickad', felmeddelande: null })
    .eq('id', inbjudanId)

  return { ok: true }
}

// ── Ta bort inbjudan och auth-konto ──────────────────────────
export async function taBortInbjudan(
  inbjudanId: string,
  email: string,
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  // Ta bort rad i inbjudningar
  await supabase.from('inbjudningar').delete().eq('id', inbjudanId)

  // Ta bort auth-kontot om det finns (kaskaderar till profiles)
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const authUser = users?.users?.find((u) => u.email === email)

  if (authUser) {
    const { error } = await admin.auth.admin.deleteUser(authUser.id)
    if (error) {
      console.error('[taBortInbjudan] kunde inte ta bort auth-konto:', error.message)
      // Inbjudan är borttagen — returnerar ok ändå
    }
  }

  return { ok: true }
}

// ── Uppdatera en funktionärs profil ──────────────────────────
export async function uppdateraFunktionar(
  profilId: string,
  data: {
    full_name: string | null
    telefon: string | null
    klubb: string | null
    kompetenser: string[]
    erfarenhet: string | null
    specialkost: string | null
  },
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name:   data.full_name   || null,
      telefon:     data.telefon     || null,
      klubb:       data.klubb       || null,
      kompetenser: data.kompetenser,
      erfarenhet:  data.erfarenhet  || null,
      specialkost: data.specialkost || null,
    })
    .eq('id', profilId)

  if (error) {
    console.error('[uppdateraFunktionar] fel:', error.message)
    return { ok: false, meddelande: 'Kunde inte spara. Försök igen.' }
  }

  return { ok: true }
}

// ── Bulk-import från Excel ────────────────────────────────────
export async function importeraFunktionarer(
  formData: FormData,
): Promise<{ resultat: InbjudanResultat[] }> {
  const ctx = await verifieraTL()
  if (!ctx) return { resultat: [] }
  const { supabase, user } = ctx

  let rader: Array<{
    namn: string
    email: string
    telefon: string
    klubb: string
    kompetenser: string[]
  }>

  try {
    rader = JSON.parse(String(formData.get('rader') ?? '[]'))
  } catch {
    return { resultat: [] }
  }

  if (!Array.isArray(rader) || rader.length === 0) return { resultat: [] }

  // Max 200 rader per import
  const begransade = rader.slice(0, 200)

  const admin      = createAdminClient()
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const redirectTo = `${siteUrl}/login`
  const resultat: InbjudanResultat[] = []

  // Giltiga kompetenser (whitelist — skyddar mot godtycklig data i databasen)
  const GILTIGA_KOMPETENSER = new Set([
    'sjukvard', 'korkort', 'triathlon_erfarenhet', 'simning', 'cykel_teknik', 'engelska',
  ])

  for (const rad of begransade) {
    const email = String(rad.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      resultat.push({ email, status: 'fel', meddelande: 'Ogiltig e-post' })
      continue
    }

    // Redan inbjuden?
    const { data: befintligInbjudan } = await supabase
      .from('inbjudningar').select('status').eq('email', email).single()
    if (befintligInbjudan) {
      resultat.push({ email, status: 'redan_inbjuden' })
      continue
    }

    // Redan registrerad?
    const { data: befintligProfil } = await supabase
      .from('profiles').select('id').eq('email', email).single()
    if (befintligProfil) {
      resultat.push({ email, status: 'redan_registrerad' })
      continue
    }

    // ── INSERT inbjudningar FÖRST ────────────────────────────────
    // handle_new_user-triggern kontrollerar att e-posten finns i
    // inbjudningar innan den skapar en profil. Om inbjudan saknas
    // när auth.users INSERT sker skapas ingen profil.
    const { data: nyInbjudan, error: insertError } = await supabase
      .from('inbjudningar')
      .insert({ email, skickad_av: user.id, status: 'skickad', roll: 'funktionar' })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[importeraFunktionarer] INSERT-fel för ${email}:`, insertError.message)
      resultat.push({ email, status: 'fel', meddelande: 'Kunde inte registrera inbjudan.' })
      continue
    }

    // ── Skicka inbjudan — triggern skapar nu profilen direkt ────
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (inviteError) {
      console.error(`[importeraFunktionarer] inviteUserByEmail-fel för ${email}:`, inviteError.message)
      await supabase.from('inbjudningar').update({
        status: 'fel', felmeddelande: inviteError.message,
      }).eq('id', nyInbjudan.id)
      resultat.push({ email, status: 'fel', meddelande: 'Kunde inte skicka inbjudan.' })
      continue
    }

    // ── Förifyll profilen med Excel-data ────────────────────────
    // Triggern (handle_new_user) är synkron — profilen finns redan
    // när inviteUserByEmail returnerar. Vi uppdaterar den direkt via
    // admin-klienten med de fält som Excel-filen innehåller.
    const namn        = (String(rad.namn    ?? '').trim() || null)?.slice(0, 200) ?? null
    const telefon     = (String(rad.telefon ?? '').trim() || null)?.slice(0, 30)  ?? null
    const klubb       = (String(rad.klubb   ?? '').trim() || null)?.slice(0, 100) ?? null
    const kompetenser = Array.isArray(rad.kompetenser)
      ? rad.kompetenser.filter((k: unknown) => typeof k === 'string' && GILTIGA_KOMPETENSER.has(k as string))
      : []

    // Bygg uppdateringsobjekt — inkludera bara fält med värden från Excel
    const profilUppdatering: Record<string, unknown> = {}
    if (namn)                    profilUppdatering.full_name   = namn
    if (telefon)                 profilUppdatering.telefon     = telefon
    if (klubb)                   profilUppdatering.klubb       = klubb
    if (kompetenser.length > 0)  profilUppdatering.kompetenser = kompetenser

    if (Object.keys(profilUppdatering).length > 0) {
      const { error: profilErr } = await admin
        .from('profiles')
        .update(profilUppdatering)
        .eq('email', email)

      if (profilErr) {
        // Inte ett hårt fel — inbjudan är skickad, profilen fylls i av funktionären
        console.warn(`[importeraFunktionarer] kunde inte förifyll profil för ${email}:`, profilErr.message)
      }
    }

    resultat.push({ email, status: 'skickad' })
  }

  return { resultat }
}

// ── Ta bort en funktionär helt (profil + auth-konto) ─────────
export async function taBortFunktionar(
  profilId: string,
  email: string,
): Promise<{ ok: boolean; meddelande?: string }> {
  const ctx = await verifieraTL()
  if (!ctx) return { ok: false, meddelande: 'Ej behörig' }

  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const authUser = users?.users?.find((u) => u.email === email)

  if (authUser) {
    const { error } = await admin.auth.admin.deleteUser(authUser.id)
    if (error) {
      console.error('[taBortFunktionar] fel:', error.message)
      return { ok: false, meddelande: 'Kunde inte ta bort kontot. Försök igen.' }
    }
  } else {
    // Inget auth-konto — ta bort profilen direkt
    const { supabase } = ctx
    await supabase.from('profiles').delete().eq('id', profilId)
  }

  return { ok: true }
}
