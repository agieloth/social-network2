package services

import (
	"social/models"
	"social/repositories"
)

type NotificationService struct {
	Repo *repositories.NotificationRepository
}

func NewNotificationService(repo *repositories.NotificationRepository) *NotificationService {
	return &NotificationService{Repo: repo}
}

func (s *NotificationService) GetUserNotifications(userID int) ([]models.Notification, error) {
	return s.Repo.GetNotificationsByUserID(userID)
}

func (s *NotificationService) MarkNotificationsAsSeen(userID int, notificationID int, markAll bool) error {
	if markAll {
		return s.Repo.MarkAllAsSeen(userID)
	} else if notificationID > 0 {
		return s.Repo.MarkOneAsSeen(notificationID, userID)
	}
	return nil
}

// service/notification_service.go
func (s *NotificationService) DeleteNotification(userID, notificationID int) error {
	return s.Repo.DeleteNotification(userID, notificationID)
}
