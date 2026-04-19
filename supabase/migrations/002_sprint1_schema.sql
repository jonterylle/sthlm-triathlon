-- ============================================================
-- Migration 002: Sprint 1 – Sektioner, Pass, Tilldelningar
-- ============================================================

-- ------------------------------------------------------------
-- 1. SEKTIONER
-- Representerar en fysisk post/sektion på tävlingsbanan
-- ------------------------------------------------------------
CREATE TABLE public.sektioner (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namn          text NOT NULL,
  beskrivning   text,
  farg          text NOT NULL DEFAULT '#0066CC',  -- hex-färg för karta/UI
  lat           double precision,                  -- WGS84 latitud
  lng           double precision,                  -- WGS84 longitud
  behovs_antal  integer NOT NULL DEFAULT 1,        -- totalt behövda funktionärer
  sortorder     integer NOT NULL DEFAULT 0,
  skapad_av     uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. PASS (skift/tider)
-- Varje sektion kan ha ett eller flera pass
-- ------------------------------------------------------------
CREATE TABLE public.pass (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sektion_id    uuid NOT NULL REFERENCES public.sektioner(id) ON DELETE CASCADE,
  namn          text NOT NULL,                     -- t.ex. "Morgonpass", "Eftermiddagspass"
  starttid      time NOT NULL,
  sluttid       time NOT NULL,
  behovs_antal  integer NOT NULL DEFAULT 1,        -- behövda för just detta pass
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. TILLDELNINGAR
-- Kopplar en profil till ett pass (och därigenom en sektion)
-- ------------------------------------------------------------
CREATE TABLE public.tilldelningar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pass_id       uuid NOT NULL REFERENCES public.pass(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'bekraftad'
                  CHECK (status IN ('bekraftad', 'avbokad', 'standby')),
  notering      text,
  tilldelad_av  uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profil_id, pass_id)                      -- en person kan bara ha ett pass per slot
);

-- ------------------------------------------------------------
-- 4. UPDATED_AT TRIGGERS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sektioner_updated_at
  BEFORE UPDATE ON public.sektioner
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tilldelningar_updated_at
  BEFORE UPDATE ON public.tilldelningar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 5. VIEWS – användbar statistik för dashboarden
-- ------------------------------------------------------------

-- Hur många bekräftade tilldelningar finns per pass
CREATE OR REPLACE VIEW public.pass_bemanningsgrad AS
SELECT
  p.id            AS pass_id,
  p.sektion_id,
  p.namn          AS pass_namn,
  p.starttid,
  p.sluttid,
  p.behovs_antal,
  COUNT(t.id) FILTER (WHERE t.status = 'bekraftad') AS tilldelade,
  p.behovs_antal - COUNT(t.id) FILTER (WHERE t.status = 'bekraftad') AS saknas
FROM public.pass p
LEFT JOIN public.tilldelningar t ON t.pass_id = p.id
GROUP BY p.id;

-- Aggregat per sektion (summerar alla pass)
CREATE OR REPLACE VIEW public.sektion_bemanningsgrad AS
SELECT
  s.id,
  s.namn,
  s.beskrivning,
  s.farg,
  s.lat,
  s.lng,
  s.sortorder,
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
GROUP BY s.id
ORDER BY s.sortorder;

-- Funktionärer utan någon tilldelning alls
CREATE OR REPLACE VIEW public.otilldelade_funktionarer AS
SELECT p.*
FROM public.profiles p
WHERE p.role = 'funktionar'
  AND NOT EXISTS (
    SELECT 1 FROM public.tilldelningar t
    WHERE t.profil_id = p.id
      AND t.status = 'bekraftad'
  )
ORDER BY p.full_name;

-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.sektioner     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tilldelningar ENABLE ROW LEVEL SECURITY;

-- Sektioner: alla inloggade kan läsa, bara TL kan skriva
CREATE POLICY "Alla kan läsa sektioner"
  ON public.sektioner FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "TL kan hantera sektioner"
  ON public.sektioner FOR ALL
  TO authenticated USING (is_tl()) WITH CHECK (is_tl());

-- Pass: alla inloggade kan läsa, bara TL kan skriva
CREATE POLICY "Alla kan läsa pass"
  ON public.pass FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "TL kan hantera pass"
  ON public.pass FOR ALL
  TO authenticated USING (is_tl()) WITH CHECK (is_tl());

-- Tilldelningar: TL kan se alla, funktionär ser bara sina egna
CREATE POLICY "TL ser alla tilldelningar"
  ON public.tilldelningar FOR SELECT
  TO authenticated USING (is_tl());

CREATE POLICY "Funktionär ser egna tilldelningar"
  ON public.tilldelningar FOR SELECT
  TO authenticated USING (profil_id = auth.uid());

CREATE POLICY "TL kan hantera tilldelningar"
  ON public.tilldelningar FOR ALL
  TO authenticated USING (is_tl()) WITH CHECK (is_tl());

-- ------------------------------------------------------------
-- 7. GRANTS på views
-- ------------------------------------------------------------
GRANT SELECT ON public.pass_bemanningsgrad       TO authenticated;
GRANT SELECT ON public.sektion_bemanningsgrad    TO authenticated;
GRANT SELECT ON public.otilldelade_funktionarer  TO authenticated;
