CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  group_id INTEGER,  -- New column, can be NULL for non-group notifications
  event_id INTEGER,  -- New column, can be NULL for non-group notifications
  type TEXT NOT NULL, -- "follow_request", "follow_accept", "group_join_request", etc.
  message TEXT,
  seen BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) -- Optional foreign key if you want to enforce referential integrity
  FOREIGN KEY (event_id) REFERENCES group_events(id) -- Optional foreign key if you want to enforce referential integrity
);