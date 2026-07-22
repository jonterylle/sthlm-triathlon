-- ============================================================
-- Migration 025: Backfill profiler för inbjudna som ej loggat in
--
-- Problem: migration 022 fixade handle_new_user-triggern, men
-- bjudIn-funktionen lade in inbjudningar-raden EFTER att triggern
-- redan hade kört (vid inviteUserByEmail). Det innebär att alla
-- funktionärer som bjöds in innan denna fix saknar profil och
-- kan därmed inte tilldelas pass.
--
-- Lösning: Skapa profiler för alla auth.users-poster vars e-post
-- finns i inbjudningar med status 'skickad' men saknar profiles-rad.
--
-- Kör detta i Supabase Dashboard → SQL Editor
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data ->> 'full_name',
  COALESCE(i.roll, 'funktionar')::public.user_role
FROM auth.users u
JOIN public.inbjudningar i ON lower(i.email) = lower(u.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
