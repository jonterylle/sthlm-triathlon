-- ============================================================
-- Migration 028: Backfill profiler för inbjudna utan profiles-rad
--
-- Problem: handle_new_user-triggern utlöses bara vid nytt INSERT
-- i auth.users. Om auth-användaren redan existerade (t.ex. pga
-- tidigare inbjudan som inte rensades) skapas ingen profil.
-- Tidigare kördes migration 025 men sedan dess har fler funktionärer
-- importerats med samma buggtillstånd.
--
-- Vad scriptet gör:
--   1. Skapar profiles-rader för alla auth.users vars e-post finns
--      i inbjudningar med status 'skickad' men saknar profiles-rad.
--   2. Skapar profiles-rader för auth.users vars e-post finns i
--      inbjudningar med status 'accepterad' men ändå saknar profil
--      (kantfall: accepterad men profil saknas av annan anledning).
--   3. Sätter roll från inbjudningar om tillgänglig.
--   4. Förifyll full_name från auth.users raw_user_meta_data om finns.
--
-- Kör i Supabase Dashboard → SQL Editor
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
  COALESCE(i.roll, 'funktionar')::public.user_role
FROM auth.users u
JOIN public.inbjudningar i
  ON lower(i.email) = lower(u.email)
LEFT JOIN public.profiles p
  ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Rapport: hur många profiler skapades/hoppades
DO $$
DECLARE
  antal integer;
BEGIN
  SELECT COUNT(*) INTO antal
  FROM auth.users u
  JOIN public.inbjudningar i ON lower(i.email) = lower(u.email)
  JOIN public.profiles p     ON p.id = u.id
  WHERE p.created_at > NOW() - INTERVAL '5 seconds';

  RAISE NOTICE 'Backfill klart: % nya profil(er) skapade.', antal;
END;
$$;
