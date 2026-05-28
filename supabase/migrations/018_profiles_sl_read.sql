-- ============================================================
-- Migration 018: SL kan läsa alla profiler
-- Sektionsledare behöver se alla funktionärer, SL och TL
-- i Funktionärer-vyn. Utan denna policy returneras bara
-- den inloggades egen profil.
-- ============================================================

CREATE POLICY "profiles: sl read all"
  ON public.profiles FOR SELECT
  USING (public.is_sektionsledare());
