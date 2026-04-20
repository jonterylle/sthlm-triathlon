# STHLM Triathlon 2026 — Funktionärsapp

Volunteer management app for STHLM Triathlon, 9 August 2026, Stora Skuggan, Djurgården.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + Backend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL + Auth) |
| Email (magic links) | Resend |
| Hosting | Vercel |

## Sprint 0 — Walking Skeleton ✅

- [x] Next.js project with TypeScript + Tailwind
- [x] Supabase auth — passwordless magic link login
- [x] Role-based routing (TL / Sektionsledare / Funktionär)
- [x] TL dashboard (empty shell)
- [x] Funktionär welcome page
- [x] Database schema with RLS policies
- [x] Deployed to Vercel

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase and Resend keys.

## Database Setup

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
After running it, log in once with your email, then run the seed query
at the bottom of the migration file to give yourself the TL role.

## Sprint Plan

| Sprint | Focus | Status |
|--------|-------|--------|
| 0 | Walking skeleton | ✅ Done |
| 1 | Volunteer registration + sections | ✅ Done |
| 2 | Schedule + conflict detection | ✅ Done |
| 3 | Invitations + email/SMS flow | ✅ Done |
| 4 | Volunteer mobile view | — |
| 5 | Excel import | — |
| 6 | Race day mode | — |
| 7 | OWASP audit + polish | — |

## Pending Tasks (post-sprint 3)

### Infrastructure
- [ ] Kör `npm install @supabase/supabase-js@2.48.1` lokalt, committa ny `package-lock.json`, ta sedan bort `typescript.ignoreBuildErrors` i `next.config.ts`
- [ ] Kör migration `007_security_fixes.sql` i Supabase SQL Editor
- [ ] Lägg till `ELKS_API_USERNAME` och `ELKS_API_PASSWORD` i Vercel env vars
- [ ] Verifiera att `NEXT_PUBLIC_SITE_URL` är satt korrekt i Vercel

### Testning
- [ ] Testa hela flödet: SMS → `/anmalan/[token]` → TL "Skicka inbjudan" → magic link → `/welcome`
- [ ] Testa e-postflödet: TL bjuder in → magic link → `/welcome`

## GDPR — Datarensningsplan

Appen samlar in personuppgifter om ~70–80 funktionärer: namn, e-post, telefon,
klubb, sektionspreferens, specialkost/allergier. Dessa måste hanteras enligt GDPR.

**Rättslig grund:** Berättigat intresse (genomförande av idrottsevenemang)
eller samtycke (beroende på hur inbjudan formuleras).

**Åtgärder efter tävlingen (9 aug 2026):**
1. Anonymisera eller radera `profiles`-tabellen (behåll anonymiserade stats om behövs)
2. Radera `sms_inbjudningar` och `inbjudningar` (innehåller telefonnummer + e-post)
3. Radera Supabase Auth-användare eller anonymisera email

**SQL-skript för rensning (körs efter event):**
```sql
-- Anonymisera profiler (behåll roll + statistik, radera PII)
UPDATE profiles SET
  full_name = 'Anonym funktionär',
  telefon = NULL,
  klubb = NULL,
  erfarenhet = NULL,
  specialkost = NULL
WHERE role = 'funktionar';

-- Radera inbjudningstabeller
DELETE FROM inbjudningar;
DELETE FROM sms_inbjudningar;
```

> ⚠️ Kör detta EFTER att du exporterat eventuell statistik du vill behålla.

## Säkerhetsanteckningar

- Middleware (`middleware.ts`) sköter session-refresh för alla routes
- Alla Server Actions validerar TL-roll server-side (`verifieraTL()`)
- SMS-inbjudningstokens löper ut efter 30 dagar (migration 007)
- Token-uppslag via SECURITY DEFINER-funktion — anon kan inte lista hela tabellen
- HTTP security headers konfigurerade i `next.config.ts` (CSP, HSTS, X-Frame-Options)
