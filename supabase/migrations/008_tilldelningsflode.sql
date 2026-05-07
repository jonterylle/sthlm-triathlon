-- ============================================================
-- Migration 008: Sprint 5 -- Tilldelningsflöde
-- ============================================================

-- RPC: hämta alla pass med sektionsinfo (för tilldelningsmodalen)
CREATE OR REPLACE FUNCTION public.get_pass_med_sektioner()
RETURNS TABLE (
  pass_id       uuid,
  pass_namn     text,
  starttid      time,
  sluttid       time,
  behovs_antal  integer,
  tilldelade    bigint,
  saknas        bigint,
  sektion_id    uuid,
  sektion_namn  text,
  sektion_farg  text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    pb.pass_id,
    pb.pass_namn,
    pb.starttid,
    pb.sluttid,
    pb.behovs_antal,
    pb.tilldelade,
    pb.saknas,
    pb.sektion_id,
    s.namn  AS sektion_namn,
    s.farg  AS sektion_farg
  FROM public.pass_bemanningsgrad pb
  JOIN public.sektioner s ON s.id = pb.sektion_id
  ORDER BY s.sortorder, pb.starttid;
$$;

GRANT EXECUTE ON FUNCTION public.get_pass_med_sektioner() TO authenticated;

-- RPC: hämta alla tilldelade funktionärer med passinfo (för sektionskort)
CREATE OR REPLACE FUNCTION public.get_tilldelade_per_pass()
RETURNS TABLE (
  tilldelning_id  uuid,
  profil_id       uuid,
  full_name       text,
  email           text,
  telefon         text,
  kompetenser     text[],
  pass_id         uuid,
  pass_namn       text,
  starttid        time,
  sluttid         time,
  sektion_id      uuid,
  notering        text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    t.id        AS tilldelning_id,
    p.id        AS profil_id,
    p.full_name,
    p.email,
    p.telefon,
    p.kompetenser,
    pa.id       AS pass_id,
    pa.namn     AS pass_namn,
    pa.starttid,
    pa.sluttid,
    pa.sektion_id,
    t.notering
  FROM public.tilldelningar t
  JOIN public.profiles p  ON p.id  = t.profil_id
  JOIN public.pass    pa  ON pa.id = t.pass_id
  WHERE t.status = 'bekraftad'
  ORDER BY pa.sektion_id, pa.starttid, p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_tilldelade_per_pass() TO authenticated;
