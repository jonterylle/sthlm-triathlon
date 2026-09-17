-- ════════════════════════════════════════════════════════════════════
-- 031: Verifiera att purgen (030) gick igenom korrekt
--
-- ENDAST LÄSNING — ändrar ingenting, säker att köra när som helst.
--
-- Returnerar en rad per kontroll med status OK / FEL / INFO.
-- Allt ska vara OK. Varje FEL beskriver vad som är kvar och bör åtgärdas.
--
-- En enda SELECT-sats → fungerar genom Supabases connection pooler.
-- ════════════════════════════════════════════════════════════════════

WITH behall AS (
  SELECT p.id FROM public.profiles p WHERE p.role = 'tl'
  UNION
  SELECT u.id FROM auth.users u WHERE lower(u.email) = 'jonas.rylander@gmail.com'
),

-- ── Kärnkontroller: stämmer behåll-listan? ────────────────────────────
k1 AS (
  SELECT 1 AS nr,
         'Minst en TL finns kvar' AS kontroll,
         CASE WHEN count(*) > 0 THEN 'OK' ELSE 'FEL' END AS status,
         count(*)::text || ' TL-konto(n)' AS detalj
  FROM public.profiles WHERE role = 'tl'
),
k2 AS (
  SELECT 2,
         'jonas.rylander@gmail.com finns kvar',
         CASE WHEN count(*) = 1 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 1 THEN 'kontot finns'
              ELSE 'SAKNAS — kontot är borta' END
  FROM auth.users WHERE lower(email) = 'jonas.rylander@gmail.com'
),
k3 AS (
  SELECT 3,
         'Inga konton utöver behåll-listan',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'inga överblivna konton'
              ELSE count(*)::text || ' konto(n) kvar som skulle raderats' END
  FROM auth.users u WHERE u.id NOT IN (SELECT id FROM behall)
),

-- ── Dörr 1: auth-konton utan profil ───────────────────────────────────
-- Ett konto utan profil syns inte i appen men kan fortfarande begära
-- magic link. Ska vara 0 efter purgen.
k4 AS (
  SELECT 4,
         'Inga föräldralösa auth-konton (utan profil)',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'inga'
              ELSE count(*)::text || ' konto(n) utan profil: ' ||
                   coalesce(string_agg(u.email, ', '), '') END
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
),

-- ── Dörr 2: vitlistan i inbjudningar ──────────────────────────────────
-- Ligger en raderad adress kvar här kan personen begära magic link och
-- släppas in automatiskt av /auth/callback. Detta är den viktigaste
-- kontrollen för att purgen verkligen kräver ny inbjudan.
k5 AS (
  SELECT 5,
         'Inga inbjudningar kvar för raderade adresser',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'vitlistan är ren'
              ELSE count(*)::text || ' inbjudan/inbjudningar kvar: ' ||
                   coalesce(string_agg(i.email, ', '), '') END
  FROM public.inbjudningar i
  WHERE lower(i.email) NOT IN (
    SELECT lower(u.email) FROM auth.users u WHERE u.id IN (SELECT id FROM behall)
  )
),

-- ── Dörr 3: SMS-tokens för självregistrering ──────────────────────────
k6 AS (
  SELECT 6,
         'Inga SMS-inbjudningar kvar',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'inga tokens kvar'
              ELSE count(*)::text || ' token(s) kvar — ger tillgång via /anmalan/<token>' END
  FROM public.sms_inbjudningar
),

-- ── Att eventstrukturen överlevde ─────────────────────────────────────
k7 AS (
  SELECT 7,
         'Sektioner finns kvar',
         CASE WHEN count(*) > 0 THEN 'OK' ELSE 'FEL' END,
         count(*)::text || ' sektion(er)'
  FROM public.sektioner
),
k8 AS (
  SELECT 8,
         'Pass finns kvar',
         CASE WHEN count(*) > 0 THEN 'OK' ELSE 'FEL' END,
         count(*)::text || ' pass'
  FROM public.pass
),

-- ── Informationsrader (inte fel, men bra att se) ──────────────────────
i1 AS (
  SELECT 9,
         'Kvarvarande tilldelningar',
         'INFO',
         count(*)::text || ' tilldelning(ar)'
  FROM public.tilldelningar
),
i2 AS (
  SELECT 10,
         'Sektioner utan sektionsledare',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'INFO' END,
         CASE WHEN count(*) = 0 THEN 'alla sektioner har ledare'
              ELSE count(*)::text || ' utan ledare: ' ||
                   coalesce(string_agg(namn, ', ' ORDER BY namn), '') END
  FROM (
    SELECT s.namn
    FROM public.sektioner s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sektion_sektionsledare ss WHERE ss.sektion_id = s.id
    )
  ) q
),
i3 AS (
  SELECT 11,
         'Kvarvarande konton totalt',
         'INFO',
         count(*)::text || ' konto(n)'
  FROM auth.users
)

SELECT nr AS "#", kontroll, status, detalj
FROM (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3
  UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6
  UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM i1 UNION ALL SELECT * FROM i2 UNION ALL SELECT * FROM i3
) alla
ORDER BY nr;


-- ════════════════════════════════════════════════════════════════════
-- KOMPLETTERANDE: lista exakt vilka konton som finns kvar.
-- Kör separat. Läs igenom — varje rad här kan logga in i appen.
-- ════════════════════════════════════════════════════════════════════
--
-- SELECT u.email,
--        p.role,
--        p.full_name,
--        u.last_sign_in_at::date AS senast_inloggad,
--        (SELECT count(*) FROM public.tilldelningar t WHERE t.profil_id = p.id) AS uppdrag
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- ORDER BY p.role NULLS FIRST, u.email;
