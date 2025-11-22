package repositories

import (
	"database/sql"
	"social/models"
	"strings"
)

type SqliteProfileRepo struct {
	db *sql.DB
}

func NewProfileRepository(db *sql.DB) *SqliteProfileRepo {
	return &SqliteProfileRepo{db: db}
}

func (r *SqliteProfileRepo) GetByID(userID int) (*models.User, error) {
	query := `
		SELECT id, email, first_name, last_name, date_of_birth,
		       nickname, about, avatar, is_private
		FROM users
		WHERE id = ?;
	`

	var user models.User
	err := r.db.QueryRow(query, userID).Scan(
		&user.ID,
		&user.Email,
		&user.FirstName,
		&user.LastName,
		&user.DateOfBirth,
		&user.Nickname,
		&user.About,
		&user.Avatar,
		&user.IsPrivate,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *SqliteProfileRepo) FindByID(userID int) (*models.Profile, error) {
	row := r.db.QueryRow(`
		SELECT id, first_name, last_name, nickname, email, about, avatar, date_of_birth, is_private
		FROM users WHERE id = ?
	`, userID)

	var user models.Profile
	err := row.Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Nickname,
		&user.Email, &user.About, &user.Avatar, &user.DateOfBirth, &user.IsPrivate,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *SqliteProfileRepo) IsFollowing(followerID, followedID int) (bool, error) {
	var status string
	err := r.db.QueryRow(`
		SELECT status FROM followers
		WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID).Scan(&status)

	if err != nil {
		return false, err
	}
	return status == "accepted", nil
}

func (r *SqliteProfileRepo) IsPending(followerID, followedID int) (bool, error) {
	var status string
	err := r.db.QueryRow(`
		SELECT status FROM followers
		WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID).Scan(&status)

	if err != nil {
		return false, err
	}
	return status == "pending", nil
}

func (ur *SqliteProfileRepo) SearchUsers(query string) ([]models.SearchResult, error) {
	search := "%" + strings.ToLower(query) + "%"
	rows, err := ur.db.Query(`
		SELECT id, first_name, last_name, nickname
		FROM users
		WHERE LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(nickname) LIKE ?
	`, search, search, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var user models.SearchResult
		if err := rows.Scan(&user.ID, &user.FirstName, &user.LastName, &user.Nickname); err != nil {
			continue // optionally log
		}
		results = append(results, user)
	}

	return results, nil
}

func (r *SqliteProfileRepo) TogglePrivacy(userID int, isPrivate bool) error {
	_, err := r.db.Exec(`UPDATE users SET is_private = ? WHERE id = ?`, isPrivate, userID)
	return err
}