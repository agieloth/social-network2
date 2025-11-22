package models

type Notification struct {
	ID             int    `json:"id"`
	SenderID       int    `json:"sender_id"`
	SenderNickname string `json:"sender_nickname"`
	Type           string `json:"type"`
	Message        string `json:"message"`
	Seen           bool   `json:"seen"`
	CreatedAt      string `json:"created_at"`
	GroupId        int    `json:"group_id,omitempty"`
	EventId        int    `json:"event_id,omitempty"`
}
