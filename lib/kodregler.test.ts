import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Vakttester som läser källkoden och kontrollerar att fel vi redan
 * har rättat inte smyger tillbaka. Kompletterar enhetstesterna:
 * enhetstesterna kollar att hjälpfunktionerna är korrekta, dessa
 * kollar att koden faktiskt använder dem.
 */

// process.cwd() är projektroten när vitest körs via npm-scriptet.
// (__dirname finns inte i ESM-kontext, vilket vitest kör testerna i.)
const rot = process.cwd()
const läs = (p: string) => readFileSync(join(rot, p), 'utf8')

describe('avsändaradress', () => {
  it('sthlm-triathlon.se förekommer inte som avsändare någonstans', () => {
    const actions = läs('app/dashboard/actions.ts')
    expect(actions).not.toContain('noreply@sthlm-triathlon.se')
  })
})

describe('login-flödet', () => {
  const login = läs('app/login/page.tsx')

  it('hanterar INITIAL_SESSION, inte bara SIGNED_IN', () => {
    // Race condition: SIGNED_IN hinner avfyras innan lyssnaren registrerats,
    // då får den nya lyssnaren INITIAL_SESSION i stället.
    expect(login).toContain('INITIAL_SESSION')
  })

  it('har inget await direkt i onAuthStateChange-callbacken', () => {
    // Supabase håller ett internt lås under callbacken — await där ger deadlock.
    const match = login.match(/onAuthStateChange\(\s*(async)?\s*\(/)
    expect(match, 'onAuthStateChange saknas i login-sidan').not.toBeNull()
    expect(match![1], 'callbacken får inte vara async — ger deadlock').toBeUndefined()
  })

  it('skickar magic link till /login, inte /auth/callback', () => {
    // Implicit flow levererar token som hash-fragment; /auth/callback
    // förväntar sig en PKCE-kod och skulle avvisa den.
    expect(login).toContain('emailRedirectTo: `${location.origin}/login`')
  })
})

describe('supabase-klienten', () => {
  it('använder implicit flow (löser cross-device-inloggning)', () => {
    const client = läs('lib/supabase/client.ts')
    expect(client).toContain("flowType: 'implicit'")
  })
})
