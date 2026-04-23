-- ============================================================
-- Migration 006: Sprint 3 – SMS-inbjudningar
-- ============================================================

CREATE TABLE public.sms_inbjudningar (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefon             text NOT NULL,
  token               text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  skickad_av          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  skickad_at          timestamptz NOT NULL DEFAULT now(),
  email_inkommen      text,
  email_inkommen_at   timestamptz,
  status              text NOT NULL DEFAULT 'skickad'
                        CHECK (status IN ('skickad', 'email_inkommen', 'inbjudan_skickad'))
);

ALTER TABLE public.sms_inbjudningar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TL hanterar SMS-inbjudningar"
  ON public.sms_inbjudningar FOR ALL
  TO authenticated
  USING (is_tl()) WITH CHECK (is_tl());

-- Publik läsning av token (för /anmalan/[token]-sidan, ingen auth)
CREATE POLICY "Token-uppslag är publikt"
  ON public.sms_inbjudningar FOR SELECT
  TO anon
  USING (true);
