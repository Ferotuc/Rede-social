CREATE TABLE messages (
 id INTEGER PRIMARY KEY,
 sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 content TEXT NOT NULL DEFAULT '' CHECK(length(content)<=2000),
 media BLOB,
 media_type TEXT,
 media_kind TEXT CHECK(media_kind IN ('image','audio','video')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(sender_id<>recipient_id),
 CHECK(length(trim(content))>0 OR media IS NOT NULL)
);
CREATE INDEX messages_participants ON messages(sender_id,recipient_id,id);
