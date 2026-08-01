-- System chat rooms (the "חדרי צ'אט" screen).
--
-- A room is "system" purely because its id is NEGATIVE: get_system_chat_rooms()
-- in helper.py returns `chat_rooms` filtered to id < 0, and ws/chat.py treats a
-- negative peerId as a public room instead of a DM.
--
-- room_id is what the user sees -- it is rendered as the room title.
-- from_user_id / to_user_id are unused for system rooms; they exist only
-- because the table is shared with the (now unused) DM-room shape.
--
-- Nothing in the app creates rooms, so new rooms are added here by hand.

CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id           INTEGER      PRIMARY KEY,
    room_id      VARCHAR(255) NOT NULL,
    from_user_id INTEGER      NOT NULL,
    to_user_id   INTEGER      NOT NULL
);


-- ---------------------------------------------------------------------------
-- Add the two new rooms.
--
-- Each statement takes the next free negative id (one below the current
-- minimum) and does nothing if a room with that name already exists, so the
-- script is safe to run more than once.
-- ---------------------------------------------------------------------------

INSERT INTO public.chat_rooms (id, room_id, from_user_id, to_user_id)
SELECT (SELECT COALESCE(MIN(id), 0) - 1 FROM public.chat_rooms),
       'חדר הורים וילדים', 0, 0
WHERE NOT EXISTS (
    SELECT 1 FROM public.chat_rooms WHERE room_id = 'חדר הורים וילדים'
);

INSERT INTO public.chat_rooms (id, room_id, from_user_id, to_user_id)
SELECT (SELECT COALESCE(MIN(id), 0) - 1 FROM public.chat_rooms),
       'חדר 60 ומעלה', 0, 0
WHERE NOT EXISTS (
    SELECT 1 FROM public.chat_rooms WHERE room_id = 'חדר 60 ומעלה'
);


-- Check the result -- these are the rows the screen will show, in order:
--   SELECT id, room_id FROM public.chat_rooms WHERE id < 0 ORDER BY id;
