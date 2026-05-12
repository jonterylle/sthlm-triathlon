-- ============================================================
-- Migration 011: Sprint 8 — Område-gruppering av sektioner
-- Lägger till omrade-kolumn och uppdaterar vyn
-- ============================================================

-- 1. Ny ENUM för område
CREATE TYPE public.sektion_omrade AS ENUM (
  'simning',
  't1',
  'cykling',
  'lopning',
  'arena_t2',
  'ovrigt'
);

-- 2. Kolumn på sektioner-tabellen
ALTER TABLE public.sektioner
  ADD COLUMN IF NOT EXISTS omrade public.sektion_omrade NOT NULL DEFAULT 'ovrigt';

-- 3. Sätt rätt område på befintliga sektioner
UPDATE public.sektioner SET omrade = 'simning'   WHERE namn ILIKE 'Simning%';
UPDATE public.sektioner SET omrade = 't1'        WHERE namn ILIKE 'Transition 1%';
UPDATE public.sektioner SET omrade = 'cykling'   WHERE namn ILIKE 'Cykel%';
UPDATE public.sektioner SET omrade = 'arena_t2'  WHERE namn ILIKE 'Transition 2%';
UPDATE public.sektioner SET omrade = 'lopning'   WHERE namn ILIKE 'Löpning%';
UPDATE public.sektioner SET omrade = 'arena_t2'  WHERE namn ILIKE 'Målgång%';
-- Parkering, Medicin, Information → ovrigt (DEFAULT, inget UPDATE behövs)

-- 4. Uppdatera vyn sektion_bemanningsgrad så att omrade ingår
-- CREATE OR REPLACE tillåter inte kolumner att byta position — dropp och återskapa istället
DROP VIEW IF EXISTS public.sektion_bemanningsgrad;
CREATE VIEW public.sektion_bemanningsgrad AS
SELECT
  s.id,
  s.namn,
  s.beskrivning,
  s.farg,
  s.lat,
  s.lng,
  s.sortorder,
  s.omrade,
  SUM(pb.behovs_antal)  AS behovs_totalt,
  SUM(pb.tilldelade)    AS tilldelade_totalt,
  SUM(pb.saknas)        AS saknas_totalt,
  CASE
    WHEN SUM(pb.behovs_antal) = 0 THEN 'full'
    WHEN SUM(pb.tilldelade) >= SUM(pb.behovs_antal) THEN 'full'
    WHEN SUM(pb.tilldelade) > 0 THEN 'delvis'
    ELSE 'tom'
  END AS status
FROM public.sektioner s
LEFT JOIN public.pass_bemanningsgrad pb ON pb.sektion_id = s.id
GROUP BY s.id;

GRANT SELECT ON public.sektion_bemanningsgrad TO authenticated;
