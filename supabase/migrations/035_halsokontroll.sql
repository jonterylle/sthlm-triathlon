-- ════════════════════════════════════════════════════════════════════
-- 035: Hälsokontroll av datainvarianter
--
-- ENDAST LÄSNING — säker att köra när som helst.
--
-- Kontrollerar antaganden som koden bygger på men som inget enhetstest
-- kan verifiera: de krävs en riktig databas med riktiga rader. Varje
-- kontroll motsvarar en bugg som faktiskt uppstått i projektet.
--
-- Kör efter varje schemaändring och efter större importer.
-- Allt ska visa OK.
--
-- En enda SELECT → fungerar genom Supabases connection pooler.
-- ════════════════════════════════════════════════════════════════════

WITH

-- ── 1. Roll i profilen matchar inbjudan ──────────────────────────────
-- Bugg: handle_new_user satte aldrig role, så kolumnens default
-- 'funktionar' gällde. En importerad sektionsledare blev funktionär.
-- Konton som loggat in rättas av tillämpInbjudanRoll(), därför
-- begränsas kontrollen till dem som aldrig loggat in.
k1 AS (
  SELECT 1 AS nr,
         'Roll i profil matchar inbjudan' AS kontroll,
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END AS status,
         CASE WHEN count(*) = 0 THEN 'alla stämmer'
              ELSE count(*)::text || ' avviker: ' ||
                   coalesce(string_agg(rad, '; '), '') END AS detalj
  FROM (
    SELECT u.email || ' (profil=' || p.role || ', inbjudan=' || i.roll || ')' AS rad
    FROM public.profiles p
    JOIN auth.users u          ON u.id = p.id
    JOIN public.inbjudningar i ON lower(i.email) = lower(u.email)
    WHERE p.role <> i.roll
      AND u.last_sign_in_at IS NULL
    LIMIT 20
  ) q
),

-- ── 2. Bekräftade konton har profil ──────────────────────────────────
-- Bugg: profilen skapades inte när auth-användaren redan fanns, så
-- personen blev osynlig i tilldelningsmodalen.
k2 AS (
  SELECT 2,
         'Bekräftade konton har profil',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'alla har profil'
              ELSE count(*)::text || ' utan profil: ' ||
                   coalesce(string_agg(email, ', '), '') END
  FROM (
    SELECT u.email
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.email_confirmed_at IS NOT NULL AND p.id IS NULL
    LIMIT 20
  ) q
),

-- ── 3. Inga föräldralösa obekräftade konton ──────────────────────────
-- Bugg: gamla obekräftade konton blockerade nya inbjudningar med
-- "already been registered". Rensas numera automatiskt av
-- rensaObekräftatKonto, så detta ska vara 0.
k3 AS (
  SELECT 3,
         'Inga foraldralosa obekraftade konton',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'inga'
              ELSE count(*)::text || ' st: ' || coalesce(string_agg(email, ', '), '') END
  FROM (
    SELECT u.email
    FROM auth.users u
    LEFT JOIN public.profiles p     ON p.id = u.id
    LEFT JOIN public.inbjudningar i ON lower(i.email) = lower(u.email)
    WHERE u.email_confirmed_at IS NULL AND p.id IS NULL AND i.id IS NULL
    LIMIT 20
  ) q
),

-- ── 4. Inbjudningsstatus speglar verkligheten ────────────────────────
-- Bugg: status fastnade på 'skickad' för personer som faktiskt loggat in,
-- vilket fick dem att se ut som att de inte accepterat sin inbjudan.
k4 AS (
  SELECT 4,
         'Inbjudningsstatus speglar inloggning',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'konsekvent'
              ELSE count(*)::text || ' har loggat in men star som skickad' END
  FROM public.inbjudningar i
  JOIN auth.users u ON lower(u.email) = lower(i.email)
  WHERE i.status = 'skickad' AND u.last_sign_in_at IS NOT NULL
),

-- ── 5. Minst en TL finns ─────────────────────────────────────────────
k5 AS (
  SELECT 5,
         'Minst en tavlingsledare finns',
         CASE WHEN count(*) > 0 THEN 'OK' ELSE 'FEL' END,
         count(*)::text || ' TL'
  FROM public.profiles WHERE role = 'tl'
),

-- ── 6. RLS aktiverat på tabeller med persondata ──────────────────────
-- Ett schemaingrepp kan råka stänga av RLS, vilket exponerar
-- personuppgifter för alla inloggade.
k6 AS (
  SELECT 6,
         'RLS aktiverat pa tabeller med persondata',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FEL' END,
         CASE WHEN count(*) = 0 THEN 'alla skyddade'
              ELSE 'RLS AV pa: ' || coalesce(string_agg(tabell, ', '), '') END
  FROM (
    SELECT c.relname AS tabell
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('profiles', 'inbjudningar', 'sms_inbjudningar',
                        'tilldelningar', 'push_subscriptions',
                        'sektion_sektionsledare')
      AND NOT c.relrowsecurity
  ) q
),

-- ── 7. SECURITY DEFINER-funktioner har search_path ───────────────────
-- Utan pinnad search_path kan en funktion som kor med agarens
-- rattigheter luras att anropa fel objekt.
k7 AS (
  SELECT 7,
         'SECURITY DEFINER-funktioner har search_path',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'INFO' END,
         CASE WHEN count(*) = 0 THEN 'alla pinnade'
              ELSE count(*)::text || ' utan: ' || coalesce(string_agg(fn, ', '), '') END
  FROM (
    SELECT p.proname AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (p.proconfig IS NULL
           OR array_to_string(p.proconfig, ',') NOT LIKE '%search_path%')
    LIMIT 30
  ) q
),

-- ── 8. Informationsrader ─────────────────────────────────────────────
i1 AS (
  SELECT 8,
         'Sektioner utan ansvarig',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'INFO' END,
         CASE WHEN count(*) = 0 THEN 'alla har ansvarig'
              ELSE count(*)::text || ' st: ' || coalesce(string_agg(namn, ', '), '') END
  FROM (
    SELECT s.namn
    FROM public.sektioner s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sektion_sektionsledare ss WHERE ss.sektion_id = s.id
    )
  ) q
),
i2 AS (
  SELECT 9,
         'Rollfordelning',
         'INFO',
         coalesce((
           SELECT string_agg(role || ': ' || antal, ', ' ORDER BY role)
           FROM (SELECT role, count(*) AS antal FROM public.profiles GROUP BY role) r
         ), 'inga profiler')
)

SELECT nr AS "#", kontroll, status, detalj
FROM (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3
  UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6
  UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM i1 UNION ALL SELECT * FROM i2
) alla
ORDER BY nr;
