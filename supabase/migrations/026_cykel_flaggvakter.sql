-- ============================================================
-- Migration 026: Skapa 17 Flaggvakt-uppdrag under Cykel
-- Kör i: Supabase Dashboard → SQL Editor
-- ============================================================

-- Steg 1: Kontrollera att Cykel-sektionen finns (kör detta först om du vill verifiera)
-- SELECT id, namn FROM public.sektioner WHERE namn ILIKE '%cykel%';

-- Steg 2: Skapa 17 Flaggvakt-uppdrag
INSERT INTO public.pass (
  sektion_id,
  namn,
  datum,
  starttid,
  sluttid,
  behovs_antal,
  kompetenser,
  klader_utrustning,
  instruktion
)
SELECT
  (SELECT id FROM public.sektioner WHERE namn ILIKE '%cykel%' LIMIT 1),
  'Flaggvakt',
  '2026-08-09',
  '09:00',
  '17:00',
  2,
  ARRAY[]::text[],
  'Gul reflexväst, Röd flagga',
  'Visa cyklisterna rätt väg och heja på dem. Stoppa fotgängare och bilister från att komma in på banan. Om bilister kommer in på banan meddela ansvarig för cykeldelen Anders Månsson.'
FROM generate_series(1, 17);

-- Steg 3: Verifiera resultatet
SELECT
  s.namn AS sektion,
  p.namn,
  p.datum,
  p.starttid,
  p.sluttid,
  p.behovs_antal,
  p.klader_utrustning
FROM public.pass p
JOIN public.sektioner s ON s.id = p.sektion_id
WHERE s.namn ILIKE '%cykel%'
  AND p.namn = 'Flaggvakt'
ORDER BY p.created_at DESC
LIMIT 17;
