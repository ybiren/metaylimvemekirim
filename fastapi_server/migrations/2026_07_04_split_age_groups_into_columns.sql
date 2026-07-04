-- Split sms_updates.age_groups (text[]) into individual boolean columns.
-- Existing rows are discarded (not backfilled) per decision to just wipe old test data.

BEGIN;

TRUNCATE TABLE sms_updates;

ALTER TABLE sms_updates
    DROP COLUMN age_groups,
    ADD COLUMN age_32_43 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_up_to_40 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_up_to_49 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_45_55 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_up_to_59 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_up_to_67 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN age_67_plus BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN divorced_singles_parents_events BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN advanced_hikers_events BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
