-- ════════════════════════════════════════════════════════════════════
-- 032: Sektionsansvarig får redigera sin egen sektion
--
-- Tidigare kunde bara TL uppdatera sektioner ("TL kan hantera sektioner",
-- FOR ALL). Nu får även en sektionsledare uppdatera de sektioner hen är
-- kopplad till via sektion_sektionsledare.
--
-- INSERT och DELETE på sektioner förblir TL-only — att skapa och ta bort
-- sektioner är ett tävlingsledarbeslut. SL får ändra innehållet i sin
-- sektion, inte skapa nya eller radera befintliga.
-- ════════════════════════════════════════════════════════════════════

-- ── Hjälpfunktion: är inloggad användare ansvarig för sektionen? ──────
CREATE OR REPLACE FUNCTION public.ar_ansvarig_for_sektion(p_sektion_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sektion_sektionsledare ss
    WHERE ss.sektion_id = p_sektion_id
      AND ss.profil_id  = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.ar_ansvarig_for_sektion(uuid) TO authenticated;


-- ── UPDATE-policy för sektionsansvarig ───────────────────────────────
DROP POLICY IF EXISTS "SL uppdaterar egen sektion" ON public.sektioner;

CREATE POLICY "SL uppdaterar egen sektion"
  ON public.sektioner FOR UPDATE
  TO authenticated
  USING      (public.ar_ansvarig_for_sektion(id))
  WITH CHECK (public.ar_ansvarig_for_sektion(id));


-- ── Kvittens ─────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sektioner';
  RAISE NOTICE 'Klart. % policies pa public.sektioner.', n;
END $$;
