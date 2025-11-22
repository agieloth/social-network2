package repositories

import (
	"database/sql"
	"errors"
	"social/models"
)

type FollowRepository struct {
	DB *sql.DB
}

func NewFollowRepository(db *sql.DB) *FollowRepository {
	return &FollowRepository{DB: db}
}

func (repo *FollowRepository) FollowExists(followerID, followedID int) (bool, error) {
	var count int
	err := repo.DB.QueryRow(`
		SELECT COUNT(*) FROM followers WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID).Scan(&count)
	return count > 0, err
}

func (repo *FollowRepository) IsPrivate(followedID int) (bool, error) {
	var isPrivate bool
	err := repo.DB.QueryRow(`
		SELECT is_private FROM users WHERE id = ?
	`, followedID).Scan(&isPrivate)
	if errors.Is(err, sql.ErrNoRows) {
		return false, errors.New("user not found")
	}
	return isPrivate, err
}

func (repo *FollowRepository) InsertFollow(req models.FollowRequest) error {
	_, err := repo.DB.Exec(`
		INSERT INTO followers (follower_id, followed_id, status)
		VALUES (?, ?, ?)
	`, req.FollowerID, req.FollowedID, req.Status)
	return err
}

func (repo *FollowRepository) GetSenderName(userID int) (string, error) {
	var firstName, lastName string
	err := repo.DB.QueryRow(`
		SELECT first_name, last_name FROM users WHERE id = ?
	`, userID).Scan(&firstName, &lastName)
	if err != nil {
		return "", err
	}
	return firstName + " " + lastName, nil
}

func (r *FollowRepository) GetFollowStatus(followerID, followedID int) (string, error) {
	var status string
	err := r.DB.QueryRow(`
		SELECT status FROM followers WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID).Scan(&status)

	if err == sql.ErrNoRows {
		return "", nil // No follow relationship
	}
	if err != nil {
		return "", err // Database error
	}
	return status, nil
}

func (r *FollowRepository) AcceptFollowRequest(followerID, followedID int) error {
	_, err := r.DB.Exec(`
		UPDATE followers SET status = 'accepted'
		WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID)
	return err
}

func (r *FollowRepository) RejectFollowRequest(followerID, followedID int) error {
	_, err := r.DB.Exec(`
		DELETE FROM followers
		WHERE follower_id = ? AND followed_id = ?
	`, followerID, followedID)
	return err
}

// Notification logic
func (r *FollowRepository) UpdateFollowNotificationStatus(senderID, userID int, status string) error {
	_, err := r.DB.Exec(`
		UPDATE notifications 
		SET seen = 1
		WHERE sender_id = ? AND user_id = ? AND type = 'follow_request'
	`, senderID, userID)
	return err
}

func (r *FollowRepository) UnfollowUser(followerID, followedID int) error {
	query := `DELETE FROM followers WHERE follower_id = ? AND followed_id = ?`
	_, err := r.DB.Exec(query, followerID, followedID)
	return err
}

func (r *FollowRepository) GetFollowers(userID int) ([]models.Follower, error) {
	rows, err := r.DB.Query(`
		SELECT users.id, users.first_name, users.last_name, users.nickname, users.avatar
		FROM followers
		JOIN users ON users.id = followers.follower_id
		WHERE followers.followed_id = ? AND followers.status = 'accepted'
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var followers []models.Follower
	for rows.Next() {
		var f models.Follower
		if err := rows.Scan(&f.ID, &f.FirstName, &f.LastName, &f.Nickname, &f.Avatar); err == nil {
			followers = append(followers, f)
		}
	}

	return followers, nil
}

func (r *FollowRepository) GetFollowing(userID int) ([]models.Following, error) {
	query := `
		SELECT u.id, u.nickname, u.first_name, u.last_name, u.avatar
		FROM followers f
		JOIN users u ON f.followed_id = u.id
		WHERE f.follower_id = ? AND f.status = 'accepted'
	`
	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var following []models.Following
	for rows.Next() {
		var u models.Following
		if err := rows.Scan(&u.ID, &u.Nickname, &u.FirstName, &u.LastName, &u.Avatar); err != nil {
			continue
		}
		following = append(following, u)
	}

	return following, nil
}

func (r *FollowRepository) GetAcceptedFollowers(userID int) ([]models.Follower, error) {
	rows, err := r.DB.Query(`
		SELECT users.id, users.first_name, users.last_name, users.nickname, users.avatar
		FROM followers
		JOIN users ON users.id = followers.follower_id
		WHERE followers.followed_id = ? AND followers.status = 'accepted'
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var followers []models.Follower
	for rows.Next() {
		var f models.Follower
		if err := rows.Scan(&f.ID, &f.FirstName, &f.LastName, &f.Nickname, &f.Avatar); err == nil {
			followers = append(followers, f)
		}
	}

	return followers, nil
}