-- Migration 007: Sakerhetsfixar sprint 3
--
-- 1. Lagger till expires_at pa SMS-inbjudningstokens (30 dagar)
-- 2. Fixar RLS-bugg: anon-policy gav full tabellatkomst
-- 3. Skapar SECURITY DEFINER-funktioner for token-uppslag

-- 1. Lagg till expires_at
ALTER TABLE public.sms_inbjudningar
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW() + INTERVAL '30 days';

UPDATE public.sms_inbjudningar
SET expires_at = skickad_at + INTERVAL '30 days'
WHERE expires_at IS NULL
   OR expires_at < skickad_at;

-- 2. Ta bort den overbroad anon SELECT-policyn
DROP POLICY IF EXISTS "Token-uppslag är publikt" ON public.sms_inbjudningar;

-- 3. SECURITY DEFINER-funktion for token-uppslag (lases-only)
CREATE OR REPLACE FUNCTION public.hamta_sms_inbjudan(p_token TEXT)
RETURNS TABLE (
  id             UUID,
  email_inkommen TEXT,
  status         TEXT,
  expires_at     TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    email_inkommen,
    status,
    expires_at
  FROM public.sms_inbjudningar
  WHERE token = p_token
    AND expires_at > NOW()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.hamta_sms_inbjudan(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.hamta_sms_inbjudan(TEXT) TO authenticated;

-- 4. SECURITY DEFINER-funktion for att registrera e-post via token
CREATE OR REPLACE FUNCTION public.registrera_email_for_sms_inbjudan(
  p_token TEXT,
  p_email TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id             UUID;
  v_expires_at     TIMESTAMPTZ;
  v_email_inkommen TEXT;
BEGIN
  SELECT id, expires_at, email_inkommen
    INTO v_id, v_expires_at, v_email_inkommen
  FROM sms_inbjudningar
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'ogiltig_token';
  END IF;

  IF v_expires_at <= NOW() THEN
    RETURN 'utgangen';
  END IF;

  IF v_email_inkommen IS NOT NULL THEN
    RETURN 'redan_registrerad';
  END IF;

  UPDATE sms_inbjudningar
  SET
    email_inkommen    = p_email,
    email_inkommen_at = NOW(),
    status            = 'email_inkommen'
  WHERE id = v_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrera_email_for_sms_inbjudan(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.registrera_email_for_sms_inbjudan(TEXT, TEXT) TO authenticated;
