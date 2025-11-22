package services

import (
	"fmt"
	"social/models"
	"social/repositories"
	"time"
)

type FollowService struct {
	Repo      *repositories.FollowRepository
	NotifRepo *repositories.NotificationRepository
}

func NewFollowService(repo *repositories.FollowRepository, NotifRepo *repositories.NotificationRepository) *FollowService {
	return &FollowService{Repo: repo, NotifRepo: NotifRepo}
}

func (s *FollowService) SendFollowRequest(followerID, followedID int) (models.Notification, string, error) {
    exists, err := s.Repo.FollowExists(followerID, followedID)
    if err != nil {
        return models.Notification{}, "", err
    }
    if exists {
        return models.Notification{}, "already_following", nil
    }

    isPrivate, err := s.Repo.IsPrivate(followedID)
    if err != nil {
        return models.Notification{}, "", err
    }

    status := "pending"
    if !isPrivate {
        status = "accepted"
    }

    req := models.FollowRequest{
        FollowerID: followerID,
        FollowedID: followedID,
        Status:     status,
    }

    err = s.Repo.InsertFollow(req)
    if err != nil {
        return models.Notification{}, "", err
    }

    var notification models.Notification
    
    // Only create notification for private accounts (pending requests)
    if isPrivate {
        senderName, err := s.Repo.GetSenderName(followerID)
        if err != nil {
            return models.Notification{}, "", err
        }

        // Create notification object
        notification = models.Notification{
            SenderID:       followerID,
            SenderNickname: senderName,
            Type:           "follow_request",
            Message:        fmt.Sprintf("%s sent you a follow request", senderName),
            Seen:           false,
            CreatedAt:      time.Now().Format(time.RFC3339),
        }

        // Insert notification into database
        err = s.NotifRepo.CreateFollowRequestNotification(followedID, followerID, senderName)
        if err != nil {
            return models.Notification{}, "", err
        }
    }

    return notification, status, nil
}

func (s *FollowService) GetFollowStatus(followerID, followedID int) (string, error) {
	return s.Repo.GetFollowStatus(followerID, followedID)
}

func (s *FollowService) AcceptFollowRequest(senderID, receiverID int) error {
	err := s.Repo.AcceptFollowRequest(senderID, receiverID)
	if err != nil {
		return err
	}
	return s.Repo.UpdateFollowNotificationStatus(senderID, receiverID, "accepted")
}

func (s *FollowService) RejectFollowRequest(senderID, receiverID int) error {
	err := s.Repo.RejectFollowRequest(senderID, receiverID)
	if err != nil {
		return err
	}
	return s.Repo.UpdateFollowNotificationStatus(senderID, receiverID, "rejected")
}

func (s *FollowService) UnfollowUser(followerID, followedID int) error {
	return s.Repo.UnfollowUser(followerID, followedID)
}

func (s *FollowService) GetFollowers(userID int) ([]models.Follower, error) {
	return s.Repo.GetFollowers(userID)
}

func (s *FollowService) GetFollowing(userID int) ([]models.Following, error) {
	return s.Repo.GetFollowing(userID)
}

func (s *FollowService) GetAcceptedFollowers(userID int) ([]models.Follower, error) {
	return s.Repo.GetAcceptedFollowers(userID)
}
