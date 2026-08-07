-- Add the 25-35 age group to sms_updates.
--
-- Unlike the split migration, existing rows are kept: they default to FALSE,
-- which is correct - nobody could have signed up for a group that did not
-- exist when they filled the form in.

BEGIN;

ALTER TABLE sms_updates
    ADD COLUMN IF NOT EXISTS age_25_35 BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
