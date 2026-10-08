-- ════════════════════════════════════════════════════════════════════
-- 033: Ny roll "domare"
--
-- Domare har samma behörighet som funktionär: ser sina egna pass och sin
-- profil, kommer inte åt adminvyerna. Rollen är en etikett för
-- bemanningsplaneringen, inte en ny behörighetsnivå.
--
-- Därför behövs INGA nya RLS-policyer. Befintliga policyer och
-- routningsskydd kontrollerar 'tl' och 'sektionsledare' explicit, så
-- domare faller automatiskt i samma kategori som funktionär.
--
-- ⚠️  VIKTIGT: ALTER TYPE ... ADD VALUE kan inte köras i samma
--     transaktion som värdet används i. Kör därför DEL 1 ensam först,
--     och DEL 2 i en separat körning.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- DEL 1 — kör denna rad för sig, utan BEGIN/COMMIT
-- ─────────────────────────────────────────────────────────────────────

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'domare';


-- ─────────────────────────────────────────────────────────────────────
-- DEL 2 — kör efter att DEL 1 committats
-- ─────────────────────────────────────────────────────────────────────

-- Verifiera att rollen finns och att inget annat behöver ändras
DO $$
DECLARE
  roller text;
BEGIN
  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) INTO roller
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'user_role';

  RAISE NOTICE 'user_role innehaller nu: %', roller;

  IF roller NOT LIKE '%domare%' THEN
    RAISE EXCEPTION 'domare saknas i user_role — kordes DEL 1?';
  END IF;
END $$;
