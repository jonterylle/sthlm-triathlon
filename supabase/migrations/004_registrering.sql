-- ============================================================
-- Migration 004: Sprint 2 – Funktionärsregistrering
-- ============================================================

-- ------------------------------------------------------------
-- 1. Nya kolumner i profiles
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefon              text,
  ADD COLUMN IF NOT EXISTS sektion_preferens    uuid REFERENCES public.sektioner(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pass_preferens       text CHECK (pass_preferens IN ('forberedelse', 'tavling', 'heldagen', 'ingen_preferens')),
  ADD COLUMN IF NOT EXISTS kompetenser          text[] DEFAULT '{}',  -- ['sjukvard','korkort','triathlon']
  ADD COLUMN IF NOT EXISTS erfarenhet           text,
  ADD COLUMN IF NOT EXISTS specialkost          text,
  ADD COLUMN IF NOT EXISTS klubb                text,
  ADD COLUMN IF NOT EXISTS registrerad_at       timestamptz;

-- ------------------------------------------------------------
-- 2. Uppdatera guard_profile_update-triggern
--    så att funktionärer kan uppdatera sina egna nya fält
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Tillåt SQL-editor (service role) att köra utan begränsningar
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Förhindra rolluppgradering för icke-TL
  IF NEW.role <> OLD.role AND NOT is_tl() THEN
    RAISE EXCEPTION 'Insufficient privileges to change role';
  END IF;

  -- Förhindra e-postspoofing
  IF NEW.email <> OLD.email AND NEW.id = auth.uid() THEN
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3. RLS: funktionär kan uppdatera sina egna registreringsfält
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Egen uppdatering av namn" ON public.profiles;

-- Rollskydd hanteras av guard_profile_update-triggern
CREATE POLICY "Funktionär uppdaterar egen profil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------
-- 4. View: registrerade funktionärer (för TL-dashboard)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.registrerade_funktionarer AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.telefon,
  p.klubb,
  p.kompetenser,
  p.erfarenhet,
  p.specialkost,
  p.pass_preferens,
  p.registrerad_at,
  s.namn AS sektion_preferens_namn
FROM public.profiles p
LEFT JOIN public.sektioner s ON s.id = p.sektion_preferens
WHERE p.role = 'funktionar'
ORDER BY p.registrerad_at DESC NULLS LAST;

GRANT SELECT ON public.registrerade_funktionarer TO authenticated;
