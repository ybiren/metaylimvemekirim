-- Lets a member exist with no password.
--
-- Registering through Google sends no password: the provider already proved
-- the address belongs to whoever filled in the form, which is what the
-- password and the emailed confirmation link were establishing at that point.
-- Such a row is written with password_hash NULL and is_email_verified true.
--
-- Nothing can log in with a null hash: get_user_by_email_pass answers "bad
-- credentials" before it reaches passlib, the same answer as a wrong password,
-- so the empty column is not a door and reveals nothing about the account.
-- The member can set a first password whenever they like through "forgot
-- password" - /reset-password assigns the hash rather than replacing one.
--
-- The model already says nullable=True (models/user.py), but nothing in this
-- project runs create_all or a migration tool, and create_all would not alter
-- an existing column anyway - so run this by hand on every database, dev and
-- prod alike. Without it the registration fails with
-- NotNullViolation on public.users.password_hash.

ALTER TABLE public.users
    ALTER COLUMN password_hash DROP NOT NULL;

-- To undo (only possible while no passwordless member exists):
-- ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;
