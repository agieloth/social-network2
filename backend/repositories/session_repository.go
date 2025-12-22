package repositories

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type SessionRepo struct {
	db *sql.DB
}

func NewSessionRepo(db *sql.DB) *SessionRepo {
	return &SessionRepo{
		db: db,
	}
}

func (s *SessionRepo) ValidateSession(r *http.Request, db *sql.DB) (int, error) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		if err == http.ErrNoCookie {
			return 0, fmt.Errorf("no session cookie")
		}
		return 0, fmt.Errorf("error reading session cookie: %v", err)
	}
	sessionID := cookie.Value
	var userID int
	var expiresAt time.Time
	query := `SELECT userId, expiresAt FROM sessions WHERE id = ?`
	err = db.QueryRow(query, sessionID).Scan(&userID, &expiresAt)
	if err != nil {
		return 0, fmt.Errorf("session not found: %v", err)
	}
	if time.Now().After(expiresAt) {
		return 0, fmt.Errorf("session expired")
	}
	return userID, nil
}

func (s *SessionRepo) CreateSession(userID int) (string, time.Time, error) {
	sessionID := uuid.New().String()
	expiration := time.Now().AddDate(1000, 0, 0)
	query := `INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)`
	_, err := s.db.Exec(query, sessionID, userID, expiration)
	if err != nil {
		log.Println("Error storing session in database:", err)
		return "", time.Time{}, err
	}
	return sessionID, expiration, nil
}

func (s *SessionRepo) GetUserNicknameById(userId int) string {
	var userNickname string
	query := `SELECT nickname FROM users WHERE id = ?`
	s.db.QueryRow(query, userId).Scan(&userNickname)
	return userNickname
}
