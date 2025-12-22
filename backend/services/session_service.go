package services

import (
	"net/http"
	"time"

	"social/db/sqlite"
	"social/repositories"
)

type SessionService struct {
	sessionRepo *repositories.SessionRepo
}

func NewSessionService(sessionRepo *repositories.SessionRepo) *SessionService {
	return &SessionService{sessionRepo: sessionRepo}
}

func (s *SessionService) GetUserIDFromSession(r *http.Request) (int, error) {
	id, err := s.sessionRepo.ValidateSession(r, sqlite.DB)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (s *SessionService) GetUserNicknameById(userId int) string {
	return s.sessionRepo.GetUserNicknameById(userId)
}

func (s *SessionService) CreateSession(userID int) (string, time.Time, error) {
	return s.sessionRepo.CreateSession(userID)
}
