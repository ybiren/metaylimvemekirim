-- Links a member to the Google / Facebook account they sign in with.
--
-- Social login currently matches on the email address alone, which fails in
-- three ways this table fixes:
--   * a Facebook account with no email address has nothing to match on at all
--     (phone-registered accounts, or a member who unticked the email
--     permission) - Facebook always returns an id, never always an address;
--   * a member who changes their email on the site loses their social login;
--   * signing in with the wrong Google account looks like a new person.
--
-- The provider id (Google's "sub", Facebook's "id") is stable forever and
-- always present, so once a row exists here the match never depends on email
-- again. Rows are written after a sign-in that already succeeded by email, so
-- most members are linked without doing anything deliberate; only the no-email
-- Facebook case needs an explicit "connect" press from inside the site.
--
-- Follow the project convention for a new table: define the model, call
-- create_all() at import time, and keep this file as the readable reference /
-- manual path for pgAdmin. See sql/user_reports.sql.

CREATE TABLE IF NOT EXISTS user_identities (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      INTEGER      NOT NULL,
    provider     VARCHAR(20)  NOT NULL,   -- 'google' | 'facebook'
    provider_uid VARCHAR(255) NOT NULL,   -- Google 'sub', Facebook 'id'
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_identity_provider_account UNIQUE (provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS ix_user_identities_user_id ON user_identities (user_id);

-- The UNIQUE above is the constraint that matters: one Google or Facebook
-- account must never map to two members, or signing in with it would be
-- ambiguous and the site would have to guess.
--
-- There is deliberately NO unique constraint on (user_id, provider). A member
-- with both a personal and a work Google account may link both to the same
-- profile; that is harmless, and the reverse - one provider account claiming
-- two profiles - is what has to be impossible.
--
-- provider is kept as free text rather than an enum so adding a third provider
-- is a code change only, matching how the rest of this schema stores small
-- fixed sets.
--
-- No foreign key across to public.users, matching user_likes, user_blocks and
-- user_reports (user_blocks.py has that FK written out and commented off on
-- purpose). The consequence to know: deleting a user row does not remove their
-- identity rows, so whatever performs a hard delete must clear this table too,
-- or a recycled id could inherit somebody else's social login.
