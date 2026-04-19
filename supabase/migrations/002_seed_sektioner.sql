-- ============================================================
-- Seed: Sektioner för STHLM Triathlon (Stora Skuggan, Norra Djurgården)
-- Kör efter 002_sprint1_schema.sql
-- ============================================================

INSERT INTO public.sektioner (namn, beskrivning, farg, lat, lng, behovs_antal, sortorder) VALUES
  ('Simning – Start',       'Startzon och stranduppgång vid Husarviken',           '#0066CC', 59.3678, 18.1012, 4, 1),
  ('Transition 1',          'Byte simning → cykel (T1) vid Stora Skuggan',        '#9333EA', 59.3655, 18.1048, 6, 2),
  ('Cykel – Norra slingan', 'Norra cykelslingan genom Norra Djurgården',           '#FF6B35', 59.3710, 18.1080, 5, 3),
  ('Cykel – Södra slingan', 'Södra cykelslingan mot Fiskartorpsvägen',             '#FF6B35', 59.3620, 18.0990, 5, 4),
  ('Transition 2',          'Byte cykel → löpning (T2) vid Stora Skuggan',        '#9333EA', 59.3655, 18.1048, 4, 5),
  ('Löpning – Bana',        'Löpbana runt Stora Skuggan, vätskestationer',         '#16A34A', 59.3640, 18.1065, 8, 6),
  ('Målgång',               'Målområde vid Stora Skuggan, tidtagning och finish',  '#DC2626', 59.3650, 18.1055, 6, 7),
  ('Parkering & Logistik',  'Funktionärsparkering, materialuthämtning',             '#6B7280', 59.3660, 18.1100, 3, 8),
  ('Medicin & HLR',         'Sjukvårdspost med AED vid målområdet',                '#EF4444', 59.3652, 18.1058, 2, 9),
  ('Information & Expo',    'Informationscentral, registrering, brickor',           '#0891B2', 59.3645, 18.1070, 4, 10);

-- Pass per sektion
INSERT INTO public.pass (sektion_id, namn, starttid, sluttid, behovs_antal)
SELECT id, 'Förberedelse', '06:00'::time, '08:00'::time, CEIL(behovs_antal * 0.5)::int FROM public.sektioner WHERE namn = 'Simning – Start'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '14:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Simning – Start'
UNION ALL
SELECT id, 'Förberedelse', '06:00'::time, '08:00'::time, CEIL(behovs_antal * 0.5)::int FROM public.sektioner WHERE namn = 'Transition 1'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '14:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Transition 1'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '14:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Cykel – Norra slingan'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '14:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Cykel – Södra slingan'
UNION ALL
SELECT id, 'Förberedelse', '06:00'::time, '08:00'::time, CEIL(behovs_antal * 0.5)::int FROM public.sektioner WHERE namn = 'Transition 2'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '14:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Transition 2'
UNION ALL
SELECT id, 'Förberedelse', '06:30'::time, '08:00'::time, CEIL(behovs_antal * 0.25)::int FROM public.sektioner WHERE namn = 'Löpning – Bana'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '14:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Löpning – Bana'
UNION ALL
SELECT id, 'Förberedelse', '07:00'::time, '08:00'::time, CEIL(behovs_antal * 0.5)::int FROM public.sektioner WHERE namn = 'Målgång'
UNION ALL
SELECT id, 'Tävling',      '08:00'::time, '15:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Målgång'
UNION ALL
SELECT id, 'Hela dagen',   '06:00'::time, '16:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Parkering & Logistik'
UNION ALL
SELECT id, 'Hela dagen',   '06:00'::time, '16:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Medicin & HLR'
UNION ALL
SELECT id, 'Hela dagen',   '06:00'::time, '16:00'::time, behovs_antal                  FROM public.sektioner WHERE namn = 'Information & Expo';
