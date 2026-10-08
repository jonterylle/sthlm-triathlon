import { describe, it, expect } from 'vitest'
import {
  normaliseraTelefon,
  ärRedanRegistrerad,
  parseEmailLista,
  parseTelefonLista,
  tolkaRoll,
  ROLL_LABELS,
  EMAIL_RE,
  RESEND_FROM_FALLBACK,
} from './validering'

// ─────────────────────────────────────────────────────────────
// 0. Rolltolkning vid Excel-import
//    Säkerhetskritiskt: en feltolkad roll ger fel behörighet.
//    Okänt värde MÅSTE ge null så att raden avvisas i stället för
//    att tystlåtet bli funktionär — eller värre, tävlingsledare.
// ─────────────────────────────────────────────────────────────
describe('tolkaRoll', () => {
  it('tolkar databasvärden', () => {
    expect(tolkaRoll('funktionar')).toBe('funktionar')
    expect(tolkaRoll('domare')).toBe('domare')
    expect(tolkaRoll('sektionsledare')).toBe('sektionsledare')
    expect(tolkaRoll('tl')).toBe('tl')
  })

  it('tolkar svenska benämningar med diakriter', () => {
    expect(tolkaRoll('Funktionär')).toBe('funktionar')
    expect(tolkaRoll('Tävlingsledare')).toBe('tl')
    expect(tolkaRoll('Sektionsansvarig')).toBe('sektionsledare')
  })

  it('är skiftlägesokänslig och tål mellanslag', () => {
    expect(tolkaRoll('  DOMARE  ')).toBe('domare')
    expect(tolkaRoll('Tävlings ledare')).toBe('tl')
  })

  // Det viktigaste: okänt får inte tolkas som något
  it('ger null för okänd roll', () => {
    expect(tolkaRoll('chef')).toBeNull()
    expect(tolkaRoll('admin')).toBeNull()
    expect(tolkaRoll('superuser')).toBeNull()
  })

  it('ger null för tom sträng', () => {
    expect(tolkaRoll('')).toBeNull()
    expect(tolkaRoll('   ')).toBeNull()
  })

  it('tolkar inte felstavningar som tävlingsledare', () => {
    // En slarvig rad ska avvisas, inte ge full behörighet
    for (const s of ['tävlingsledar', 'tlx', 't l', 'tavling', 'ledare']) {
      expect(tolkaRoll(s), `"${s}" ska inte bli tl`).not.toBe('tl')
    }
  })

  it('har en etikett för varje roll', () => {
    for (const roll of ['funktionar', 'domare', 'sektionsledare', 'tl'] as const) {
      expect(ROLL_LABELS[roll]).toBeTruthy()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 1. Telefonnormalisering till E.164
//    Regression: +46701-443172 avvisades av 46elks eftersom
//    bindestrecket inte strippades.
// ─────────────────────────────────────────────────────────────
describe('normaliseraTelefon', () => {
  it('strippar bindestreck (regression: 46elks-felet)', () => {
    expect(normaliseraTelefon('+46701-443172')).toBe('+46701443172')
  })

  it('strippar mellanslag', () => {
    expect(normaliseraTelefon('+46 70 144 31 72')).toBe('+46701443172')
  })

  it('strippar parenteser och punkter', () => {
    expect(normaliseraTelefon('+46 (0)70.144.31.72')).toBe('+460701443172')
  })

  it('ersätter inledande 0 med +46', () => {
    expect(normaliseraTelefon('0701443172')).toBe('+46701443172')
  })

  it('hanterar inledande 0 med bindestreck', () => {
    expect(normaliseraTelefon('070-144 31 72')).toBe('+46701443172')
  })

  it('lämnar redan korrekt E.164 oförändrat', () => {
    expect(normaliseraTelefon('+46701443172')).toBe('+46701443172')
  })

  it('behåller plustecknet', () => {
    expect(normaliseraTelefon('+46701443172')).toMatch(/^\+/)
  })

  it('resultatet innehåller bara siffror efter plus', () => {
    const nummer = ['+46701-443172', '070 144 31 72', '+46 (0)70-1443172']
    for (const n of nummer) {
      expect(normaliseraTelefon(n)).toMatch(/^\+?\d+$/)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 2. "Already registered"-detektion
//    Regression: regexen matchade bara "already registered" och
//    missade Supabases faktiska "has already BEEN registered".
// ─────────────────────────────────────────────────────────────
describe('ärRedanRegistrerad', () => {
  it('matchar Supabases faktiska felmeddelande (regression)', () => {
    expect(
      ärRedanRegistrerad('A user with this email address has already been registered')
    ).toBe(true)
  })

  it('matchar kort variant utan "been"', () => {
    expect(ärRedanRegistrerad('User already registered')).toBe(true)
  })

  it('matchar "user already exists"', () => {
    expect(ärRedanRegistrerad('user already exists')).toBe(true)
  })

  it('matchar felkoden email_exists', () => {
    expect(ärRedanRegistrerad('email_exists')).toBe(true)
  })

  it('är skiftlägesokänslig', () => {
    expect(ärRedanRegistrerad('A USER HAS ALREADY BEEN REGISTERED')).toBe(true)
  })

  // Lika viktigt: får INTE svälja andra fel, då döljs riktiga problem
  it('matchar inte rate limit-fel', () => {
    expect(ärRedanRegistrerad('Email rate limit exceeded')).toBe(false)
  })

  it('matchar inte valideringsfel', () => {
    expect(
      ärRedanRegistrerad('Unable to validate email address: invalid format')
    ).toBe(false)
  })

  it('matchar inte SMTP-fel', () => {
    expect(ärRedanRegistrerad('Error sending invite email')).toBe(false)
  })

  it('matchar inte tom sträng', () => {
    expect(ärRedanRegistrerad('')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// 3. E-postvalidering och listparsning
// ─────────────────────────────────────────────────────────────
describe('EMAIL_RE', () => {
  const giltiga = [
    'monicasverige@gmail.com',
    'sus_puzz@hotmail.com',
    'christine_schwenk@yahoo.de',
    'nova.skarpfors@tabyenskilda.student.se',
    'hans.oden@ackordscentralen.se',
    'noreply@funktionar.rylander.biz',
    'jonas+test@gmail.com',
  ]

  it.each(giltiga)('accepterar %s', (email: string) => {
    expect(EMAIL_RE.test(email)).toBe(true)
  })

  const ogiltiga = ['', 'ingen-snabel-a', 'saknar@domän', 'två@@snabel.se', 'med mellanslag@x.se']

  it.each(ogiltiga)('avvisar "%s"', (email: string) => {
    expect(EMAIL_RE.test(email)).toBe(false)
  })
})

describe('parseEmailLista', () => {
  it('delar på både komma och radbrytning', () => {
    expect(parseEmailLista('a@x.se, b@x.se\nc@x.se')).toEqual([
      'a@x.se',
      'b@x.se',
      'c@x.se',
    ])
  })

  it('gemeniserar och trimmar', () => {
    expect(parseEmailLista('  Jonas.Rylander@GMAIL.com  ')).toEqual([
      'jonas.rylander@gmail.com',
    ])
  })

  it('filtrerar bort ogiltiga adresser', () => {
    expect(parseEmailLista('bra@x.se, trasig, ocksåbra@y.se')).toEqual([
      'bra@x.se',
      'ocksåbra@y.se',
    ])
  })

  it('kapar vid maxantal', () => {
    const många = Array.from({ length: 60 }, (_, i) => `nr${i}@x.se`).join(',')
    expect(parseEmailLista(många)).toHaveLength(50)
  })

  it('returnerar tom lista för tom indata', () => {
    expect(parseEmailLista('')).toEqual([])
  })
})

describe('parseTelefonLista', () => {
  it('accepterar nummer med bindestreck och mellanslag', () => {
    expect(parseTelefonLista('070-144 31 72')).toEqual(['070-1443172'])
  })

  it('kapar vid maxantal 20', () => {
    const många = Array.from({ length: 30 }, () => '0701443172').join(',')
    expect(parseTelefonLista(många)).toHaveLength(20)
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Avsändaradress
//    Regression: sthlm-triathlon.se var overifierad i Resend.
// ─────────────────────────────────────────────────────────────
describe('RESEND_FROM_FALLBACK', () => {
  it('är den verifierade domänen', () => {
    expect(RESEND_FROM_FALLBACK).toBe('noreply@funktionar.rylander.biz')
  })

  it('är inte den overifierade domänen', () => {
    expect(RESEND_FROM_FALLBACK).not.toContain('sthlm-triathlon.se')
  })
})
