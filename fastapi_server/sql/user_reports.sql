-- Table behind the "דווח על תוכן פוגעני" reports shown in the admin section.
--
-- routes/mail_sender.py runs SQLAlchemy's create_all() at import time, so the
-- server creates this on its own the first time it starts. This file is the
-- readable reference / manual path for pgAdmin.

CREATE TABLE IF NOT EXISTS user_reports (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL,
    subject    TEXT        NOT NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_reports_user_id ON user_reports (user_id);

-- user_id is the reported profile, not the reporter: reporters stay anonymous
-- and their address is deliberately kept out of the report mail.
--
-- subject and content hold the two fields of the report form as filled in:
-- subject is "סוג הדיווח" (one of the fixed categories), content is the free
-- text "תיאור".
--
-- No foreign key across to public.users, matching user_likes and user_blocks
-- (user_blocks.py has that FK written out and commented off on purpose).
