-- ============================================================
-- Migration 029: Rensa specifika användare helt ur databasen
--
-- Tar bort följande e-postadresser ur alla tabeller:
--   therese@rodini.se
--   therese.rodini@gmail.com
--   nova.skarpfors@icloud.com
--   nova.skarpfors@tabyenskilda.student.se
--
-- Ordning: tilldelningar → profiler → inbjudningar → auth.users
--
-- Kör i Supabase Dashboard → SQL Editor
-- ============================================================

DO $$
DECLARE
  berorda_emails text[] := ARRAY[
    'therese@rodini.se',
    'therese.rodini@gmail.com',
    'nova.skarpfors@icloud.com',
    'nova.skarpfors@tabyenskilda.student.se'
  ];
  borttagna_tilldelningar int;
  borttagna_profiler       int;
  borttagna_inbjudningar   int;
  borttagna_auth_users     int;
BEGIN

  -- ── 1. Visa vad som kommer att tas bort (logg) ─────────────
  RAISE NOTICE '=== Berörda auth.users ===';
  PERFORM (
    SELECT string_agg(email || ' (id: ' || id::text || ')', E'\n')
    FROM auth.users
    WHERE lower(email) = ANY(berorda_emails)
  );

  -- ── 2. Tilldelningar ────────────────────────────────────────
  DELETE FROM public.tilldelningar
  WHERE profil_id IN (
    SELECT id FROM public.profiles
    WHERE lower(email) = ANY(berorda_emails)
  );
  GET DIAGNOSTICS borttagna_tilldelningar = ROW_COUNT;
  RAISE NOTICE 'Borttagna tilldelningar: %', borttagna_tilldelningar;

  -- ── 3. Profiler ─────────────────────────────────────────────
  DELETE FROM public.profiles
  WHERE lower(email) = ANY(berorda_emails);
  GET DIAGNOSTICS borttagna_profiler = ROW_COUNT;
  RAISE NOTICE 'Borttagna profiler: %', borttagna_profiler;

  -- ── 4. Inbjudningar ─────────────────────────────────────────
  DELETE FROM public.inbjudningar
  WHERE lower(email) = ANY(berorda_emails);
  GET DIAGNOSTICS borttagna_inbjudningar = ROW_COUNT;
  RAISE NOTICE 'Borttagna inbjudningar: %', borttagna_inbjudningar;

  -- ── 5. auth.users ───────────────────────────────────────────
  -- Måste göras sist eftersom profiles kan ha FK → auth.users
  DELETE FROM auth.users
  WHERE lower(email) = ANY(berorda_emails);
  GET DIAGNOSTICS borttagna_auth_users = ROW_COUNT;
  RAISE NOTICE 'Borttagna auth.users: %', borttagna_auth_users;

  RAISE NOTICE '=== Klart ===';

END;
$$;

-- Verifiera att ingenting finns kvar
SELECT
  'auth.users'   AS tabell, email FROM auth.users   WHERE lower(email) = ANY(ARRAY['therese@rodini.se','therese.rodini@gmail.com','nova.skarpfors@icloud.com','nova.skarpfors@tabyenskilda.student.se'])
UNION ALL
SELECT 'profiles',     email FROM public.profiles    WHERE lower(email) = ANY(ARRAY['therese@rodini.se','therese.rodini@gmail.com','nova.skarpfors@icloud.com','nova.skarpfors@tabyenskilda.student.se'])
UNION ALL
SELECT 'inbjudningar', email FROM public.inbjudningar WHERE lower(email) = ANY(ARRAY['therese@rodini.se','therese.rodini@gmail.com','nova.skarpfors@icloud.com','nova.skarpfors@tabyenskilda.student.se']);
-- Om inga rader returneras är städningen komplett.
