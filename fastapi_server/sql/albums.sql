-- Tables for the /admin/albums section.
--
-- routes/admin_albums.py runs SQLAlchemy's create_all() at import time, so the
-- server creates these on its own the first time it starts. This file is the
-- readable reference / manual path for pgAdmin.

CREATE TABLE IF NOT EXISTS albums (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT        NOT NULL,
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS album_photos (
    id           BIGSERIAL PRIMARY KEY,
    album_id     BIGINT      NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    filename     TEXT        NOT NULL,
    path         TEXT        NOT NULL,
    content_type TEXT,
    size         INTEGER     NOT NULL DEFAULT 0,
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_album_photos_album_id ON album_photos (album_id);

-- The picture bytes live on disk, not here:
--   fastapi_server/data/images/albums/<album_id>/<guid>.<ext>
-- album_photos.path holds that location relative to fastapi_server/.
