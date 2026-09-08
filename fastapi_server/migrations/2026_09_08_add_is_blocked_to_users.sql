-- Admin-level block on a user account.
--
-- Distinct from the user_blocks table, which is one member blocking another.
-- This one is set by an admin from /admin/users and stops the account from
-- logging in at all.
--
-- Existing rows default to FALSE: nobody was blocked before the column
-- existed, so that is the only correct backfill.

BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
