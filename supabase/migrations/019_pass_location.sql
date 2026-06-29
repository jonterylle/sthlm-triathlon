-- ============================================================
-- Migration 019: Kartposition på funktionärsuppdrag (pass)
-- Lägger till lat/lng på pass-tabellen och uppdaterar
-- get_pass_med_sektioner för att returnera dessa fält.
-- ============================================================

ALTER TABLE public.pass
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lng  double precision;

-- Uppdatera RPC
DROP FUNCTION IF EXISTS public.get_pass_med_sektioner();
CREATE FUNCTION public.get_pass_med_sektioner()
RETURNS TABLE (
  pass_id        uuid,
  pass_namn      text,
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
  ORDER BY p.starttid;
$$;

GRANT EXECUTE ON FUNCTION public.get_pass_med_sektioner() TO authenticated;
