-- ============================================================
-- Migration 003: Säkerhetsfixar från Sprint 1 Security Review
-- ============================================================

-- ------------------------------------------------------------
-- 1. GDPR-fix: begränsa otilldelade_funktionarer till TL
--    Ta bort generellt GRANT och ersätt med en RLS-liknande
--    säkerhetsbarriär via en security definer-funktion.
-- ------------------------------------------------------------
REVOKE SELECT ON public.otilldelade_funktionarer FROM authenticated;

-- Skapa en security definer-funktion som bara TL kan anropa
CREATE OR REPLACE FUNCTION public.get_otilldelade_funktionarer()
RETURNS TABLE (
  id          uuid,
  email       text,
  full_name   text,
  role        text,
  created_at  timestamptz,
  updated_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kontrollera att anroparen är TL
  IF NOT is_tl() THEN
    RAISE EXCEPTION 'Åtkomst nekad: endast tävlingsledare kan se otilldelade funktionärer';
  END IF;

  RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role::text, p.created_at, p.updated_at
    FROM public.profiles p
    WHERE p.role = 'funktionar'
      AND NOT EXISTS (
        SELECT 1 FROM public.tilldelningar t
        WHERE t.profil_id = p.id
          AND t.status = 'bekraftad'
      )
    ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_otilldelade_funktionarer() TO authenticated;

-- ------------------------------------------------------------
-- 2. Hex-validering på farg-kolumnen i sektioner
-- ------------------------------------------------------------
ALTER TABLE public.sektioner
  ADD CONSTRAINT sektioner_farg_hex
  CHECK (farg ~ '^#[0-9A-Fa-f]{6}$');
