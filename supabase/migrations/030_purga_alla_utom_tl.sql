-- ════════════════════════════════════════════════════════════════════
-- 030: Purga alla användare utom TL + jonas.rylander@gmail.com
--
-- BEHÅLLER:  alla konton med role = 'tl', samt jonas.rylander@gmail.com.
--            Sektioner och pass lämnas orörda.
--
-- RADERAR:   alla övriga konton (funktionärer och sektionsledare),
--            deras profiler, tilldelningar, sektionsledarkopplingar,
--            push-prenumerationer, e-postinbjudningar och ALLA
--            SMS-inbjudningar.
--
-- EFTER KÖRNING måste en raderad person bjudas in på nytt av TL innan
-- hen kan logga in. Tre dörrar stängs samtidigt:
--   1) auth.users       — själva kontot
--   2) inbjudningar     — vitlistan som /auth/callback kontrollerar
--   3) sms_inbjudningar — tokens som ger självregistrering via /anmalan/<token>
-- Utan steg 2 och 3 skulle personen kunna begära en ny magic link och
-- släppas in igen automatiskt.
--
-- ⚠️  IRREVERSIBELT. Säkerställ backup/PITR innan du kör.
-- ⚠️  ALLA TILLDELNINGAR för raderade personer försvinner
--     (tilldelningar.profil_id är ON DELETE CASCADE).
-- ⚠️  Kör FÖRHANDSGRANSKNINGEN längst ned FÖRST.
--
-- Hela skriptet är EN enda DO-sats. Det är avsiktligt: Supabases
-- SQL-editor går via en connection pooler där separata satser kan hamna
-- på olika backend-anslutningar. Temptabeller och BEGIN/COMMIT över
-- flera satser fungerar därför inte tillförlitligt där. En DO-sats körs
-- i en egen transaktion — vid RAISE EXCEPTION rullas allt tillbaka.
--
-- Markera hela blocket nedan och kör det i ett svep.
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  behall        uuid[];
  tl_id         uuid;
  r             record;
  antal_kvar    int;
  antal_tl      int;
  jonas_finns   boolean;
  tilldeln_fore int;
  n_konton      int;
  n_profiler    int;
  n_tilldeln    int;
  n_inbj        int;
BEGIN
  -- ── 1. Bygg behåll-listan ──────────────────────────────────────────
  SELECT array_agg(id) INTO behall
  FROM (
    SELECT p.id FROM public.profiles p WHERE p.role = 'tl'
    UNION
    SELECT u.id FROM auth.users u
    WHERE lower(u.email) = 'jonas.rylander@gmail.com'
  ) x;

  IF behall IS NULL OR array_length(behall, 1) IS NULL THEN
    RAISE EXCEPTION 'AVBRYTER: behåll-listan är tom — allt skulle raderas.';
  END IF;

  antal_kvar := array_length(behall, 1);

  -- ── 2. Spärrar ─────────────────────────────────────────────────────
  SELECT count(*) INTO antal_tl
  FROM public.profiles p
  WHERE p.id = ANY (behall) AND p.role = 'tl';

  IF antal_tl = 0 THEN
    RAISE EXCEPTION
      'AVBRYTER: ingen TL skulle finnas kvar — du skulle låsas ute ur appen.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = 'jonas.rylander@gmail.com'
  ) INTO jonas_finns;

  IF NOT jonas_finns THEN
    RAISE WARNING
      'OBS: jonas.rylander@gmail.com finns inte i auth.users — endast TL-konton behålls.';
  END IF;

  SELECT count(*) INTO tilldeln_fore
  FROM public.tilldelningar WHERE NOT (profil_id = ANY (behall));

  RAISE NOTICE 'Behåller % konto(n), varav % TL. % tilldelning(ar) kommer att raderas.',
    antal_kvar, antal_tl, tilldeln_fore;

  SELECT p.id INTO tl_id
  FROM public.profiles p
  WHERE p.id = ANY (behall) AND p.role = 'tl'
  ORDER BY p.id
  LIMIT 1;

  -- ── 3. Lös upp FK:er utan ON DELETE-regel ──────────────────────────
  -- Kolumner som pekar på profiles(id) med NO ACTION/RESTRICT blockerar
  -- raderingen. Hämtas ur systemkatalogen i stället för att hårdkodas,
  -- så att skriptet inte kan gissa fel på tabell- eller kolumnnamn.
  FOR r IN
    SELECT con.conrelid::regclass::text AS tabell,
           att.attname::text            AS kolumn
    FROM pg_constraint con
    JOIN pg_attribute  att
      ON att.attrelid = con.conrelid
     AND att.attnum   = ANY (con.conkey)
    WHERE con.contype   = 'f'
      AND con.confrelid = 'public.profiles'::regclass
      AND con.confdeltype IN ('a', 'r')      -- a = NO ACTION, r = RESTRICT
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'UPDATE %s SET %I = $1 WHERE %I IS NOT NULL AND NOT (%I = ANY($2))',
      r.tabell, r.kolumn, r.kolumn, r.kolumn
    ) USING tl_id, behall;

    RAISE NOTICE 'Pekade om %.% till kvarvarande TL.', r.tabell, r.kolumn;
  END LOOP;

  -- ── 4. Stäng vitlistan: radera e-postinbjudningar ──────────────────
  DELETE FROM public.inbjudningar
  WHERE lower(email) NOT IN (
    SELECT lower(u.email) FROM auth.users u WHERE u.id = ANY (behall)
  );

  -- ── 5. Stäng självregistreringen: radera alla SMS-inbjudningar ─────
  DELETE FROM public.sms_inbjudningar;

  -- ── 6. Radera konton ───────────────────────────────────────────────
  -- profiles, tilldelningar, sektion_sektionsledare och push_subscriptions
  -- följer med automatiskt via ON DELETE CASCADE.
  DELETE FROM auth.users
  WHERE NOT (id = ANY (behall));

  -- ── 7. Kvittens ────────────────────────────────────────────────────
  SELECT count(*) INTO n_konton   FROM auth.users;
  SELECT count(*) INTO n_profiler FROM public.profiles;
  SELECT count(*) INTO n_tilldeln FROM public.tilldelningar;
  SELECT count(*) INTO n_inbj     FROM public.inbjudningar;

  RAISE NOTICE 'KLART. Kvar: % konton, % profiler, % tilldelningar, % inbjudningar.',
    n_konton, n_profiler, n_tilldeln, n_inbj;
END $$;


-- ════════════════════════════════════════════════════════════════════
-- FÖRHANDSGRANSKNING — kör SEPARAT och FÖRE blocket ovan.
-- Ändrar ingenting. Använder CTE:er, inga temptabeller.
-- ════════════════════════════════════════════════════════════════════
--
-- -- A) Sammanfattning
-- WITH behall AS (
--   SELECT id FROM public.profiles WHERE role = 'tl'
--   UNION
--   SELECT id FROM auth.users WHERE lower(email) = 'jonas.rylander@gmail.com'
-- )
-- SELECT
--   (SELECT count(*) FROM auth.users WHERE id IN     (SELECT id FROM behall)) AS konton_kvar,
--   (SELECT count(*) FROM auth.users WHERE id NOT IN (SELECT id FROM behall)) AS konton_raderas,
--   (SELECT count(*) FROM public.tilldelningar
--      WHERE profil_id NOT IN (SELECT id FROM behall))                        AS tilldelningar_forloras,
--   (SELECT count(*) FROM public.tilldelningar
--      WHERE profil_id IN (SELECT id FROM behall))                            AS tilldelningar_kvar,
--   (SELECT count(*) FROM public.sms_inbjudningar)                            AS sms_inbjudningar_raderas;
--
-- -- B) Exakt vilka konton som behålls
-- SELECT u.email, p.role, p.full_name
-- FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.role = 'tl' OR lower(u.email) = 'jonas.rylander@gmail.com'
-- ORDER BY p.role, u.email;
--
-- -- C) Vilka sektioner blir utan sektionsledare
-- WITH behall AS (
--   SELECT id FROM public.profiles WHERE role = 'tl'
--   UNION
--   SELECT id FROM auth.users WHERE lower(email) = 'jonas.rylander@gmail.com'
-- )
-- SELECT s.namn AS sektion_utan_ledare
-- FROM public.sektioner s
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.sektion_sektionsledare ss
--   WHERE ss.sektion_id = s.id AND ss.profil_id IN (SELECT id FROM behall)
-- )
-- ORDER BY s.namn;
