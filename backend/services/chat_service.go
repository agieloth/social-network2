package services

import (
	"errors"
	"social/models"
	"social/repositories"
)

type ChatService struct {
	Repo *repositories.ChatRepository
}

// NewChatService creates a new ChatService with the given repository
func NewChatService(repo *repositories.ChatRepository) *ChatService {
	return &ChatService{Repo: repo}
}

func (s *ChatService) GetAllChatUsers(requesterID int) ([]models.ChatUser, error) {
	users, err := s.Repo.GetAllUsers(requesterID)
	if err != nil {
		return nil, err
	}

	// Enrich users with CanChat flag
	for i, user := range users {
		if user.ID == requesterID {
			users[i].CanChat = false
			continue
		}

		canChat, err := s.Repo.CanUsersChat(requesterID, user.ID)
		if err != nil {
			users[i].CanChat = false
		} else {
			users[i].CanChat = canChat
		}
	}

	return users, nil
}
func (s *ChatService) CanChat(userID, otherID int) (bool, error){
	return s.Repo.CanUsersChat(userID, otherID)
}
func (s *ChatService) GetChatHistory(userID, otherID int) ([]models.Message, error) {
	canChat, err := s.Repo.CanUsersChat(userID, otherID)
	if err != nil {
		return nil, err
	}
	if !canChat {
		return nil, errors.New("chat not allowed: users must follow each other")
	}
	return s.Repo.GetChatHistory(userID, otherID)
}

func (s *ChatService) ProcessPrivateMessage(msg models.Message) error {
	// Check access rights
	hasAccess, err := s.Repo.CheckPrivateProfileAccess(msg.From, msg.To)
	if err != nil || !hasAccess {
		return err
	}
	
	// Save message
	return s.Repo.SavePrivateMessage(msg)
}

func (s *ChatService) ProcessGroupMessage(msg models.Message) error {
	// Validate group membership would go here
	
	// Save message
	return s.Repo.SaveGroupMessage(msg)
}

func (s *ChatService) GetGroupMembers(groupID int) ([]models.GroupMember, error) {
	return s.Repo.GetGroupMembers(groupID)
}