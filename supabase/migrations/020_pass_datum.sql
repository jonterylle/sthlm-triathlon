-- ============================================================
-- Migration 020: Datum på funktionärsuppdrag (pass)
-- Lägger till datum-kolumn med default tävlingsdagen
-- (söndag 9 aug 2026) och uppdaterar get_pass_med_sektioner.
-- ============================================================

ALTER TABLE public.pass
  ADD COLUMN IF NOT EXISTS datum text NOT NULL DEFAULT '2026-08-09';

-- Uppdatera befintliga rader som saknar datum
UPDATE public.pass SET datum = '2026-08-09' WHERE datum IS NULL;

-- Uppdatera RPC — inkludera datum och sortera på datum + starttid
DROP FUNCTION IF EXISTS public.get_pass_med_sektioner();
CREATE FUNCTION public.get_pass_med_sektioner()
RETURNS TABLE (
  pass_id        uuid,
  pass_namn      text,
  datum          text,
  starttid       text,
  sluttid        text,
  behovs_antal   int,
  tilldelade     bigint,
  saknas         bigint,
  sektion_id     uuid,
  sektion_namn   text,
  sektion_farg   text,
  kompetenser    text[],
  lat            double precision,
  lng            double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                                        AS pass_id,
    p.namn                                                      AS pass_namn,
    p.datum,
    p.starttid,
    p.sluttid,
    p.behovs_antal,
    COUNT(t.id) FILTER (WHERE t.status = 'bekraftad')           AS tilldelade,
    GREATEST(0, p.behovs_antal
      - COUNT(t.id) FILTER (WHERE t.status = 'bekraftad'))      AS saknas,
    s.id                                                        AS sektion_id,
    s.namn                                                      AS sektion_namn,
    s.farg                                                      AS sektion_farg,
    COALESCE(p.kompetenser, '{}')                               AS kompetenser,
    p.lat,
    p.lng
  FROM public.pass p
  JOIN public.sektioner s ON s.id = p.sektion_id
  LEFT JOIN public.tilldelningar t ON t.pass_id = p.id
  GROUP BY p.id, s.id
  ORDER BY p.datum, p.starttid;
$$;

GRANT EXECUTE ON FUNCTION public.get_pass_med_sektioner() TO authenticated;

-- Uppdatera även get_min_sektion_data (SL-vy) för att inkludera datum
DROP FUNCTION IF EXISTS public.get_min_sektion_data();
CREATE FUNCTION public.get_min_sektion_data()
RETURNS TABLE (
  sektion_id      uuid,
  sektion_namn    text,
  sektion_farg    text,
  pass_id         uuid,
  pass_namn       text,
  datum           text,
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
    pa.datum,
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
  ORDER BY s.sortorder, pa.datum, pa.starttid, p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_min_sektion_data() TO authenticated;
