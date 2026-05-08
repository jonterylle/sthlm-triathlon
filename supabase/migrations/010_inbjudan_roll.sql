-- Migration 010: Lägg till roll-kolumn på inbjudningar
-- TL kan nu bjuda in antingen en funktionär eller en sektionsledare.
-- Rollen sätts automatiskt på profilen när inbjudningslänken accepteras.

ALTER TABLE inbjudningar
  ADD COLUMN IF NOT EXISTS roll user_role NOT NULL DEFAULT 'funktionar';

COMMENT ON COLUMN inbjudningar.roll IS
  'Rollen som personen tilldelas när de accepterar inbjudan. Sätts av TL vid utskick.';
