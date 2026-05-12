-- ============================================================
-- Migration 012: Sprint 9 — Pass CRUD-policies + Push-prenumerationer
-- ============================================================

-- 1. RLS-policy: TL kan skapa, uppdatera och ta bort pass
--    (SELECT-policy finns redan via authenticated-grant på vyn)
CREATE POLICY "TL hanterar pass"
  ON public.pass FOR ALL
  TO authenticated
  USING (is_tl())
  WITH CHECK (is_tl());

-- 2. Tabell för Web Push-prenumerationer
CREATE TABLE public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profil_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Funktionär hanterar sina egna prenumerationer
CREATE POLICY "Funktionär hanterar egna push-prenumerationer"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (profil_id = auth.uid())
  WITH CHECK (profil_id = auth.uid());

-- TL kan se alla prenumerationer (för att skicka push)
CREATE POLICY "TL ser alla push-prenumerationer"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (is_tl());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
