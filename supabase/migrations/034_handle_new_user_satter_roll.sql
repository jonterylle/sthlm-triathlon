-- ════════════════════════════════════════════════════════════════════
-- 034: handle_new_user sätter roll från inbjudan
--
-- BUGG: triggern infogade (id, email, full_name) utan role, så kolumnens
-- default 'funktionar' gällde alltid. Rollen i inbjudningar.roll lästes
-- aldrig. Den som bjöds in som sektionsledare eller tävlingsledare — via
-- Excel-import eller e-postinbjudan — fick därför role='funktionar'.
--
-- Appen försökte rätta detta med en upsert efter inviteUserByEmail, men
-- den använde ignoreDuplicates: true och blev en no-op eftersom triggern
-- redan hade skapat profilen.
--
-- Felet dolde sig delvis: tillämpInbjudanRoll() sätter rätt roll vid
-- första inloggningen. Men fram till dess visades personen med fel roll,
-- och loggade de aldrig in blev den aldrig rättad.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Triggern läser nu rollen ur inbjudan ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inbjuden_roll public.user_role;
BEGIN
  -- Skapa profil bara om e-posten är inbjuden.
  SELECT i.roll INTO inbjuden_roll
  FROM public.inbjudningar i
  WHERE lower(i.email) = lower(NEW.email)
  ORDER BY i.skickad_at DESC
  LIMIT 1;

  IF inbjuden_roll IS NULL THEN
    -- Inte inbjuden — returnera utan att skapa profil.
    -- auth/callback fångar detta och dirigerar om till login.
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    inbjuden_roll
  );

  RETURN NEW;
END;
$$;


-- ── 2. FÖRHANDSGRANSKNING — kör denna FÖRST, separat ─────────────────
-- Visar vilka profiler som har fel roll till följd av buggen.
--
-- SELECT u.email,
--        p.role            AS nuvarande_roll,
--        i.roll            AS roll_i_inbjudan,
--        u.last_sign_in_at IS NULL AS har_aldrig_loggat_in
-- FROM public.profiles p
-- JOIN auth.users u          ON u.id = p.id
-- JOIN public.inbjudningar i ON lower(i.email) = lower(u.email)
-- WHERE p.role = 'funktionar'
--   AND i.roll <> 'funktionar'
-- ORDER BY u.email;


-- ── 3. Rätta befintliga profiler ─────────────────────────────────────
-- Begränsat till konton som ALDRIG loggat in. De som har loggat in har
-- redan fått rätt roll via tillämpInbjudanRoll(), och en bredare
-- uppdatering riskerar att skriva över en roll som TL ändrat för hand.
UPDATE public.profiles p
SET role = i.roll
FROM auth.users u, public.inbjudningar i
WHERE p.id = u.id
  AND lower(i.email) = lower(u.email)
  AND p.role = 'funktionar'
  AND i.roll <> 'funktionar'
  AND u.last_sign_in_at IS NULL;


-- ── 4. Kvittens ──────────────────────────────────────────────────────
DO $$
DECLARE
  kvar int;
BEGIN
  SELECT count(*) INTO kvar
  FROM public.profiles p
  JOIN auth.users u          ON u.id = p.id
  JOIN public.inbjudningar i ON lower(i.email) = lower(u.email)
  WHERE p.role = 'funktionar' AND i.roll <> 'funktionar';

  IF kvar = 0 THEN
    RAISE NOTICE 'Klart. Alla profiler matchar sin inbjudan.';
  ELSE
    RAISE NOTICE 'Klart. % profil(er) har fortfarande role=funktionar trots annan roll i inbjudan — de har loggat in och lamnas ororda. Granska med forhandsgranskningen ovan.', kvar;
  END IF;
END $$;
