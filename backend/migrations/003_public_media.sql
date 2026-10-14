CREATE TABLE post_attachments (
 post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
 media BLOB NOT NULL,
 media_type TEXT NOT NULL,
 media_kind TEXT NOT NULL CHECK(media_kind IN ('image','audio','video'))
);
