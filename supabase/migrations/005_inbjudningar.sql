-- ============================================================
-- Migration 005: Sprint 3 – Inbjudningar
-- ============================================================

CREATE TABLE public.inbjudningar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  skickad_av  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  skickad_at  timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL DEFAULT 'skickad'
                CHECK (status IN ('skickad', 'accepterad', 'fel')),
  felmeddelande text,
  UNIQUE (email)  -- en inbjudan per e-postadress
);

ALTER TABLE public.inbjudningar ENABLE ROW LEVEL SECURITY;

-- Bara TL kan se och hantera inbjudningar
CREATE POLICY "TL hanterar inbjudningar"
  ON public.inbjudningar FOR ALL
  TO authenticated
  USING (is_tl()) WITH CHECK (is_tl());

-- Uppdatera status till 'accepterad' när en inbjuden användare loggar in
-- (körs via handle_new_user-triggern som redan finns)
