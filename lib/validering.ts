/**
 * Rena hjälpfunktioner för validering och normalisering.
 *
 * Ligger separat från server actions så att de kan enhetstestas utan
 * att Supabase, Next.js eller nätverk behöver mockas.
 */

// ── E-post ────────────────────────────────────────────────────
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Telefon (indata-validering, innan normalisering) ──────────
export const TELEFON_RE = /^\+?[0-9\s\-]{7,15}$/

// ── Avsändaradress för Resend ─────────────────────────────────
// Måste vara en domän som är verifierad i Resend.
export const RESEND_FROM_FALLBACK = 'noreply@funktionar.rylander.biz'

/**
 * Normaliserar ett telefonnummer till E.164 (+46XXXXXXXXX).
 *
 * 46elks avvisar allt som inte är strikt E.164 — inga bindestreck,
 * mellanslag eller parenteser. Svenska nummer som börjar på 0 får
 * landskoden +46 och nollan strippad.
 */
export function normaliseraTelefon(telefon: string): string {
  const stripped = telefon.replace(/[^\d+]/g, '')
  return stripped.startsWith('0') ? '+46' + stripped.slice(1) : stripped
}

/**
 * Avgör om ett Supabase-fel betyder "användaren finns redan".
 *
 * Supabase formulerar detta olika beroende på endpoint, bl.a.
 * "A user with this email address has already been registered".
 * Regexen måste tåla ord emellan ("already BEEN registered").
 */
const REDAN_REGISTRERAD_RE =
  /already.{0,15}registered|already exists|user already exists|email_exists/i

export function ärRedanRegistrerad(felmeddelande: string): boolean {
  return REDAN_REGISTRERAD_RE.test(felmeddelande)
}

// ── Roller ────────────────────────────────────────────────────
export type Roll = 'funktionar' | 'domare' | 'sektionsledare' | 'tl'

export const ROLL_LABELS: Record<Roll, string> = {
  funktionar:     'Funktionär',
  domare:         'Domare',
  sektionsledare: 'Sektionsledare',
  tl:             'Tävlingsledare',
}

/**
 * Tolkar en roll ur fritext (t.ex. en Excel-kolumn).
 *
 * Accepterar både databasvärdet och svensk benämning, oavsett skiftläge
 * och med eller utan diakriter — "Funktionär", "funktionar" och
 * "FUNKTIONAR" ger alla 'funktionar'.
 *
 * Returnerar null för okänt värde. Anropande kod ska avvisa raden i
 * stället för att gissa: en felstavning får inte tyst ge en person
 * högre behörighet än avsett.
 */
export function tolkaRoll(raw: string): Roll | null {
  const utanDiakriter = raw
    .trim()
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')

  if (!utanDiakriter) return null

  // Kortformerna kräver exakt match. Vi kan inte strippa inre blanksteg
  // här, för då skulle "t l" tolkas som tävlingsledare — nonsens-text i
  // en cell får inte ge full behörighet.
  if (utanDiakriter === 'tl') return 'tl'
  if (utanDiakriter === 'sl') return 'sektionsledare'

  // Längre benämningar tål blanksteg och bindestreck ("Tävlings ledare")
  const kompakt = utanDiakriter.replace(/[\s_-]/g, '')

  switch (kompakt) {
    case 'funktionar':
    case 'volontar':
    case 'volunteer':
      return 'funktionar'
    case 'domare':
    case 'judge':
    case 'referee':
      return 'domare'
    case 'sektionsledare':
    case 'sektionsansvarig':
      return 'sektionsledare'
    case 'tavlingsledare':
    case 'racedirector':
      return 'tl'
    default:
      return null
  }
}

/**
 * Parsar en fritextlista med e-postadresser (kommaseparerad eller radbruten).
 * Trimmar, gemeniserar, filtrerar bort ogiltiga och kapar vid maxAntal.
 */
export function parseEmailLista(raw: string, maxAntal = 50): string[] {
  return raw
    .split(/[\n,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e))
    .slice(0, maxAntal)
}

/**
 * Parsar en fritextlista med telefonnummer.
 * Obs: returnerar råa (validerade) nummer — kör normaliseraTelefon före sändning.
 */
export function parseTelefonLista(raw: string, maxAntal = 20): string[] {
  return raw
    .split(/[\n,]+/)
    .map((t) => t.trim().replace(/\s/g, ''))
    .filter((t) => TELEFON_RE.test(t))
    .slice(0, maxAntal)
}
