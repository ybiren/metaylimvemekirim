-- Who is allowed into /admin, and what their browser presents to prove it.
--
-- Until this, /admin was reachable by anyone who typed the URL and the
-- /api/admin endpoints answered anyone at all - a route guard in the browser
-- would have hidden the screens while leaving the endpoints open to curl.
--
--   is_admin        may open /admin and call /api/admin/*. Granted here and
--                   nowhere else: no screen hands out this flag, so nobody can
--                   grant it to themselves through the site. Revoke by setting
--                   it false - the next request is refused.
--   admin_token     issued at /api/admin/login, sent back on every admin
--                   request, cleared at logout. Indexed because it is looked
--                   up on each one.
--   admin_token_at  when it was issued, so a forgotten session expires instead
--                   of lasting forever.
--
-- Nothing in this project runs migrations, so run this by hand on every
-- database, dev and prod alike. See sql/users_password_hash_nullable.sql.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_token    VARCHAR(128),
    ADD COLUMN IF NOT EXISTS admin_token_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_users_admin_token
    ON public.users (admin_token);

-- The first admin. The account must already exist - this grants the flag, it
-- does not create anybody.
UPDATE public.users
   SET is_admin = true
 WHERE lower(email) = 'sar888@gmail.com';

-- Check it landed on exactly the account you meant:
-- SELECT id, email, is_admin FROM public.users WHERE is_admin;
