-- ============================================================
-- Migration 016: Kopplingstabell sektion_sektionsledare
-- Ersätter sektion_preferens på profiles som enda koppling
-- SL → sektion. En SL kan nu ansvara för flera sektioner.
-- ============================================================

-- 1. Skapa kopplingstabell
CREATE TABLE IF NOT EXISTS public.sektion_sektionsledare (
  sektion_id  uuid NOT NULL REFERENCES public.sektioner(id) ON DELETE CASCADE,
  profil_id   uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  skapad_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sektion_id, profil_id)
);

ALTER TABLE public.sektion_sektionsledare ENABLE ROW LEVEL SECURITY;

-- TL ser och hanterar alla rader
CREATE POLICY "TL hanterar sektion_sektionsledare"
  ON public.sektion_sektionsledare FOR ALL
  TO authenticated
  USING (is_tl())
  WITH CHECK (is_tl());

-- SL ser sina egna rader
CREATE POLICY "SL ser sina sektionskopplingar"
  ON public.sektion_sektionsledare FOR SELECT
  TO authenticated
  USING (profil_id = auth.uid());

-- 2. Backfill: migrera befintliga sektion_preferens-värden
INSERT INTO public.sektion_sektionsledare (sektion_id, profil_id)
SELECT sektion_preferens, id
FROM public.profiles
WHERE role = 'sektionsledare'
  AND sektion_preferens IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Uppdatera RLS-policies på tilldelningar (SL ser/ändrar sin sektions tilldelningar)
DROP POLICY IF EXISTS "SL kan uppdatera mat_utdelad"    ON public.tilldelningar;
DROP POLICY IF EXISTS "SL ser sin sektions tilldelningar" ON public.tilldelningar;

CREATE POLICY "SL kan uppdatera mat_utdelad"
  ON public.tilldelningar FOR UPDATE
  TO authenticated
  USING (
    is_sektionsledare() AND EXISTS (
      SELECT 1
      FROM public.pass pa
      JOIN public.sektion_sektionsledare ss
        ON ss.sektion_id = pa.sektion_id AND ss.profil_id = auth.uid()
      WHERE pa.id = tilldelningar.pass_id
    )
  )
  WITH CHECK (
    is_sektionsledare() AND EXISTS (
      SELECT 1
      FROM public.pass pa
      JOIN public.sektion_sektionsledare ss
        ON ss.sektion_id = pa.sektion_id AND ss.profil_id = auth.uid()
      WHERE pa.id = tilldelningar.pass_id
    )
  );

CREATE POLICY "SL ser sin sektions tilldelningar"
  ON public.tilldelningar FOR SELECT
  TO authenticated
  USING (
    is_sektionsledare() AND EXISTS (
      SELECT 1
      FROM public.pass pa
      JOIN public.sektion_sektionsledare ss
        ON ss.sektion_id = pa.sektion_id AND ss.profil_id = auth.uid()
      WHERE pa.id = tilldelningar.pass_id
    )
  );

-- 4. Uppdatera get_min_sektion_data — använder nya tabellen, returnerar alla SL:s sektioner
CREATE OR REPLACE FUNCTION public.get_min_sektion_data()
RETURNS TABLE (
  sektion_id      uuid,
  sektion_namn    text,
  sektion_farg    text,
  pass_id         uuid,
  pass_namn       text,
  starttid        time,
  sluttid         time,
  behovs_antal    integer,
  tilldelning_id  uuid,
  profil_id       uuid,
  full_name       text,
  email           text,
  telefon         text,
  kompetenser     text[],
  notering        text,
  mat_utdelad     boolean
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    s.id            AS sektion_id,
    s.namn          AS sektion_namn,
    s.farg          AS sektion_farg,
    pa.id           AS pass_id,
    pa.namn         AS pass_namn,
    pa.starttid,
    pa.sluttid,
    pa.behovs_antal,
    t.id            AS tilldelning_id,
    p.id            AS profil_id,
    p.full_name,
    p.email,
    p.telefon,
    p.kompetenser,
    t.notering,
    t.mat_utdelad
  FROM public.sektion_sektionsledare ss
  JOIN public.sektioner s  ON s.id  = ss.sektion_id
  JOIN public.pass     pa  ON pa.sektion_id = s.id
  LEFT JOIN public.tilldelningar t ON t.pass_id = pa.id AND t.status = 'bekraftad'
  LEFT JOIN public.profiles      p ON p.id = t.profil_id
  WHERE ss.profil_id = auth.uid()
  ORDER BY s.sortorder, pa.starttid, p.full_name;
$$;
GRANT EXECUTE ON FUNCTION public.get_min_sektion_data() TO authenticated;

-- 5. Ny RPC: hämta alla SL-kopplingar per sektion (för TL)
CREATE OR REPLACE FUNCTION public.get_sektionsledare_per_sektion()
RETURNS TABLE (
  sektion_id  uuid,
  profil_id   uuid,
  full_name   text,
  email       text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    ss.sektion_id,
    ss.profil_id,
    p.full_name,
    p.email
  FROM public.sektion_sektionsledare ss
  JOIN public.profiles p ON p.id = ss.profil_id
  ORDER BY p.full_name;
$$;
GRANT EXECUTE ON FUNCTION public.get_sektionsledare_per_sektion() TO authenticated;

-- 6. Uppdatera get_sektionsledare — alla SL med sina sektioner (komma-separerade)
CREATE OR REPLACE FUNCTION public.get_sektionsledare()
RETURNS TABLE (
  id                uuid,
  full_name         text,
  email             text,
  sektion_preferens uuid,
  sektion_namn      text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.sektion_preferens,          -- behålls för bakåtkompatibilitet
    string_agg(s.namn, ', ' ORDER BY s.sortorder) AS sektion_namn
  FROM public.profiles p
  LEFT JOIN public.sektion_sektionsledare ss ON ss.profil_id = p.id
  LEFT JOIN public.sektioner s ON s.id = ss.sektion_id
  WHERE p.role = 'sektionsledare'
  GROUP BY p.id, p.full_name, p.email, p.sektion_preferens
  ORDER BY p.full_name;
$$;
GRANT EXECUTE ON FUNCTION public.get_sektionsledare() TO authenticated;
