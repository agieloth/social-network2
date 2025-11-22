CREATE TABLE post_permissions (
    post_id INTEGER,
    user_id INTEGER,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    PRIMARY KEY (post_id, user_id)
);