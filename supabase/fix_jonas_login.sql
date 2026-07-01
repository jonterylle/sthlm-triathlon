-- ============================================================
-- Diagnostik + fix för jonas@rylander.biz
-- Kör i Supabase → SQL Editor
-- ============================================================

-- 1. Visa alla auth-konton (vad Supabase vet om mailadresser)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at;

-- 2. Visa alla profiler + roller
SELECT id, email, role, full_name, created_at
FROM public.profiles
ORDER BY created_at;

-- 3. Visa alla inbjudningar
SELECT email, roll, status, skickad_at
FROM public.inbjudningar
ORDER BY skickad_at;

-- ─────────────────────────────────────────────────────────────
-- FIX: Se till att jonas@rylander.biz finns i inbjudningar
-- (krävs om kontot saknar profil vid nästa inloggning)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.inbjudningar (email, roll, status)
VALUES ('jonas@rylander.biz', 'tl', 'accepterad')
ON CONFLICT (email) DO UPDATE
  SET roll = 'tl', status = 'accepterad';

-- FIX: Om profil redan finns för jonas@rylander.biz — säkerställ att rollen är tl
UPDATE public.profiles
SET role = 'tl'
WHERE email = 'jonas@rylander.biz'
  AND role != 'tl';

-- FIX: Om auth.users-raden finns men profil SAKNAS — skapa profilen
INSERT INTO public.profiles (id, email, role, full_name)
SELECT u.id, u.email, 'tl', COALESCE(u.raw_user_meta_data->>'full_name', 'Jonas Rylander')
FROM auth.users u
WHERE u.email = 'jonas@rylander.biz'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

-- Bekräftelse — kolla resultatet efter fixen
SELECT 'auth.users' AS tbl, id::text, email, NULL AS role FROM auth.users WHERE email = 'jonas@rylander.biz'
UNION ALL
SELECT 'profiles', id::text, email, role FROM public.profiles WHERE email = 'jonas@rylander.biz'
UNION ALL
SELECT 'inbjudningar', NULL, email, roll FROM public.inbjudningar WHERE email = 'jonas@rylander.biz';
