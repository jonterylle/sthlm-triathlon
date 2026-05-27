-- ============================================================
-- Migration 017: Inkludera TL i get_sektionsledare
-- TL ska kunna tilldelas som ansvarig för sektioner,
-- precis som SL. Uppdaterar RPC:n att returnera båda rollerna.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_sektionsledare()
RETURNS TABLE (
  id                uuid,
  full_name         text,
  email             text,
  sektion_preferens uuid,
  sektion_namn      text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.sektion_preferens,
    string_agg(s.namn, ', ' ORDER BY s.sortorder) AS sektion_namn
  FROM public.profiles p
  LEFT JOIN public.sektion_sektionsledare ss ON ss.profil_id = p.id
  LEFT JOIN public.sektioner s ON s.id = ss.sektion_id
  WHERE p.role IN ('sektionsledare', 'tl')
  GROUP BY p.id, p.full_name, p.email, p.sektion_preferens
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_sektionsledare() TO authenticated;
