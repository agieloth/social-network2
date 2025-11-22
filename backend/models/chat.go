package models

import (
	"database/sql"
)

type ChatUser struct {
	ID           int    `json:"id"`
	FullName     string `json:"full_name"`
	Avatar       string `json:"avatar"`
	IsPrivate    bool   `json:"is_private"`
	FollowStatus string `json:"follow_status"`
	CanChat      bool   `json:"can_chat"`
}

type ChatRepository struct {
	DB *sql.DB
}
