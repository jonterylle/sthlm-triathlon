-- ============================================================
-- Migration 009: Sprint 6 -- Sektionsledarvy
-- ============================================================

-- 1. Lägg till mat_utdelad på tilldelningar
ALTER TABLE public.tilldelningar
  ADD COLUMN IF NOT EXISTS mat_utdelad boolean NOT NULL DEFAULT false;

-- 2. Helper-funktion för sektionsledarkoll (speglar is_tl)
CREATE OR REPLACE FUNCTION public.is_sektionsledare()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'sektionsledare'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_sektionsledare() TO authenticated;

-- 3. RPC: hämta SL:s sektion med pass och tilldelade funktionärer
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
  FROM public.profiles sl
  JOIN public.sektioner s  ON s.id  = sl.sektion_preferens
  JOIN public.pass     pa  ON pa.sektion_id = s.id
  LEFT JOIN public.tilldelningar t ON t.pass_id = pa.id AND t.status = 'bekraftad'
  LEFT JOIN public.profiles      p ON p.id = t.profil_id
  WHERE sl.id   = auth.uid()
    AND sl.role = 'sektionsledare'
  ORDER BY pa.starttid, p.full_name;
$$;
GRANT EXECUTE ON FUNCTION public.get_min_sektion_data() TO authenticated;

-- 4. UPDATE-policy: SL får ändra mat_utdelad på sin sektions tilldelningar
CREATE POLICY "SL kan uppdatera mat_utdelad"
  ON public.tilldelningar FOR UPDATE
  TO authenticated
  USING (
    is_sektionsledare() AND EXISTS (
      SELECT 1
      FROM public.pass   pa
      JOIN public.profiles sl
        ON sl.sektion_preferens = pa.sektion_id
        AND sl.id = auth.uid()
      WHERE pa.id = tilldelningar.pass_id
    )
  )
  WITH CHECK (
    is_sektionsledare() AND EXISTS (
      SELECT 1
      FROM public.pass   pa
      JOIN public.profiles sl
        ON sl.sektion_preferens = pa.sektion_id
        AND sl.id = auth.uid()
      WHERE pa.id = tilldelningar.pass_id
    )
  );

-- 5. SELECT-policy: SL ser tilldelningar för sin sektion
CREATE POLICY "SL ser sin sektions tilldelningar"
  ON public.tilldelningar FOR SELECT
  TO authenticated
  USING (
    is_sektionsledare() AND EXISTS (
      SELECT 1
      FROM public.pass   pa
      JOIN public.profiles sl
        ON sl.sektion_preferens = pa.sektion_id
        AND sl.id = auth.uid()
      WHERE pa.id = tilldelningar.pass_id
    )
  );

-- 6. TL kan uppdatera sektion_preferens (koppla SL till sektion)
-- Triggerguard tillåter redan TL att ändra sektion_preferens — ingen extra policy behövs.
-- Men vi behöver en enkel RPC för TL att hämta alla sektionsledare
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
    p.sektion_preferens,
    s.namn AS sektion_namn
  FROM public.profiles p
  LEFT JOIN public.sektioner s ON s.id = p.sektion_preferens
  WHERE p.role = 'sektionsledare'
  ORDER BY p.full_name;
$$;
GRANT EXECUTE ON FUNCTION public.get_sektionsledare() TO authenticated;
