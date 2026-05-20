-- ============================================================
-- Migration 014: RPC för alla funktionärer med tilldelningsräknare
-- Ersätter get_otilldelade_funktionarer i tilldelningsflödet
-- så att TL kan tilldela en funktionär flera uppdrag.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_funktionarer_for_tilldelning()
RETURNS TABLE (
  id                 uuid,
  email              text,
  full_name          text,
  role               text,
  telefon            text,
  kompetenser        text[],
  sektion_preferens  text,
  pass_preferens     text,
  registrerad_at     timestamptz,
  created_at         timestamptz,
  updated_at         timestamptz,
  antal_pass         bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_tl() THEN
    RAISE EXCEPTION 'Åtkomst nekad: endast tävlingsledare';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.role::text,
      p.telefon,
      COALESCE(p.kompetenser, '{}'),
      p.sektion_preferens,
      p.pass_preferens,
      p.registrerad_at,
      p.created_at,
      p.updated_at,
      COUNT(t.id) FILTER (WHERE t.status = 'bekraftad') AS antal_pass
    FROM public.profiles p
    LEFT JOIN public.tilldelningar t ON t.profil_id = p.id
    WHERE p.role = 'funktionar'
    GROUP BY p.id
    ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funktionarer_for_tilldelning() TO authenticated;
