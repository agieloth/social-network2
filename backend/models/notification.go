package models

type MarkNotificationSeenRequest struct {
	NotificationID int  `json:"notification_id"`
	MarkAll        bool `json:"mark_all"`
}