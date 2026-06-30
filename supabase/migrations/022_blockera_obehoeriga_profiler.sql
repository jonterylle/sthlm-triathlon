-- ============================================================
-- Migration 022: Blockera obehöriga profiler
--
-- Problem: handle_new_user skapade en profil för ALLA som
-- klickade en magic link, oavsett om de var inbjudna.
-- auth/callback kastade sedan ut dem, men profilen fanns kvar.
--
-- Fix 1: Triggern skapar nu bara profil om e-posten finns
--         i inbjudningar-tabellen.
-- Fix 2: Ta bort befintliga profiler för ej-inbjudna
--         funktionärer (se SELECT nedan för att granska först).
-- ============================================================

-- 1. Uppdatera handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Skapa profil bara om e-posten är inbjuden.
  -- TL/SL inviteras med roll i inbjudningar, funktionärer med roll 'funktionar'.
  IF NOT EXISTS (
    SELECT 1 FROM public.inbjudningar WHERE email = NEW.email
  ) THEN
    -- Inte inbjuden — returnera utan att skapa profil.
    -- auth/callback fångar detta och dirigerar om till login.
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name'
  );
  RETURN NEW;
END;
$$;

-- 2. Städa upp profiler för ej-inbjudna användare.
--    Kör först SELECT-varianten för att granska, sedan DELETE.
--
-- Granska:
--   SELECT id, email, role, created_at FROM public.profiles
--   WHERE role = 'funktionar'
--     AND email NOT IN (SELECT email FROM public.inbjudningar);
--
-- Ta bort:
DELETE FROM public.profiles
WHERE role = 'funktionar'
  AND email NOT IN (SELECT email FROM public.inbjudningar);
