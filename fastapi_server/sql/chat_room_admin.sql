-- The member who looks after a system chat room.
--
-- Chosen in /admin/rooms and shown at the top of the room, so people in it can
-- see who is responsible for it.
--
-- Nullable, and left null for every existing room: a room without an admin is
-- the ordinary state until somebody is assigned one, and the screens show no
-- name rather than an empty label.
--
-- Deliberately not a foreign key. The two columns beside it, from_user_id and
-- to_user_id, are plain integers as well, and a constraint here would turn
-- deleting a member into an error about a chat room. The query that reads it
-- is an outer join, so a member who is gone shows up as a room with no admin.
--
-- Nothing in this project runs migrations, so run this by hand on every
-- database. See sql/admin_login.sql.

ALTER TABLE public.chat_rooms
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- The rooms, and who looks after each one:
--   SELECT r.id, r.room_id, r.user_id, u.name
--     FROM public.chat_rooms r
--     LEFT JOIN public.users u ON u.id = r.user_id
--    WHERE r.id < 0
--    ORDER BY r.id;
