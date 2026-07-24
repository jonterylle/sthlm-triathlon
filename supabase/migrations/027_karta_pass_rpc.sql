-- ============================================================
-- Migration 027: RPC för kartvyn — alla pass med koordinater
-- Returnerar varje pass med koordinater: pass.lat/lng om satta,
-- annars fall-back till sektionens lat/lng.
-- Används av admin-kartan (/karta) och av volunteer-kartfunktionen.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_alle_pass_for_karta()
RETURNS TABLE (
  pass_id       uuid,
  pass_namn     text,
  datum         text,
  starttid      text,
  sluttid       text,
  sektion_id    uuid,
  sektion_namn  text,
  sektion_farg  text,
  lat           double precision,
  lng           double precision
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    p.id                              AS pass_id,
    p.namn                            AS pass_namn,
    p.datum,
    p.starttid,
    p.sluttid,
    s.id                              AS sektion_id,
    s.namn                            AS sektion_namn,
    s.farg                            AS sektion_farg,
    COALESCE(p.lat, s.lat)            AS lat,
    COALESCE(p.lng, s.lng)            AS lng
  FROM public.pass p
  JOIN public.sektioner s ON s.id = p.sektion_id
  ORDER BY s.sortorder, p.datum, p.starttid;
$$;

GRANT EXECUTE ON FUNCTION public.get_alle_pass_for_karta() TO authenticated;
