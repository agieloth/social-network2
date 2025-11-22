package repositories

import (
	"database/sql"
	"errors"
	"fmt"
	"social/models"
	"time"
)

type ChatRepository struct {
	DB *sql.DB
}

// NewChatRepository creates a new ChatRepository with the given DB connection
func NewChatRepository(db *sql.DB) *ChatRepository {
	return &ChatRepository{DB: db}
}

// GetAllUsers returns all users with their privacy info and follow status related to requesterID.
func (r *ChatRepository) GetAllUsers(requesterID int) ([]models.ChatUser, error) {
	rows, err := r.DB.Query(`SELECT id, first_name, last_name, avatar, is_private FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.ChatUser

	for rows.Next() {
		var id int
		var firstName, lastName, avatar string
		var isPrivate bool

		if err := rows.Scan(&id, &firstName, &lastName, &avatar, &isPrivate); err != nil {
			continue
		}

		fullName := firstName + " " + lastName
		user := models.ChatUser{
			ID:        id,
			FullName:  fullName,
			Avatar:    avatar,
			IsPrivate: isPrivate,
		}

		// Fetch follow status if not self
		if id != requesterID {
			var status string
			err := r.DB.QueryRow(`SELECT status FROM followers WHERE follower_id = ? AND followed_id = ?`, requesterID, id).Scan(&status)
			if err == nil {
				user.FollowStatus = status
			} else {
				user.FollowStatus = ""
			}
		}

		users = append(users, user)
	}

	return users, nil
}

func (r *ChatRepository) CanUsersChat(userID1, userID2 int) (bool, error) {
	// Vérifier si user1 suit user2 ET user2 suit user1 (suivi mutuel)
	var count int
	err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM followers 
		WHERE (follower_id = ? AND followed_id = ? AND status = 'accepted')
		OR EXISTS (
			SELECT 1 FROM followers 
			WHERE follower_id = ? AND followed_id = ? AND status = 'accepted'
		)
	`, userID1, userID2, userID2, userID1).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (r *ChatRepository) GetChatHistory(userID, otherID int) ([]models.Message, error) {
	rows, err := r.DB.Query(`
		SELECT from_id, to_id, content, type, timestamp
		FROM messages
		WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
		ORDER BY timestamp ASC
	`, userID, otherID, otherID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var msg models.Message
		var ts string
		if err := rows.Scan(&msg.From, &msg.To, &msg.Content, &msg.Type, &ts); err != nil {
			continue
		}
		// Parse timestamp string to time.Time
		t, err := time.Parse(time.RFC3339, ts)
		if err != nil {
			t = time.Time{}
		}
		msg.Timestamp = t.Format(time.RFC3339)
		messages = append(messages, msg)
	}
	return messages, nil
}

func (r *ChatRepository) SavePrivateMessage(msg models.Message) error {
	_, err := r.DB.Exec(`
		INSERT INTO messages (from_id, to_id, content, type, timestamp)
		VALUES (?, ?, ?, ?, ?)
	`, msg.From, msg.To, msg.Content, "private", time.Now())
	return err
}

func (r *ChatRepository) SaveGroupMessage(msg models.Message) error {
	_, err := r.DB.Exec(`
		INSERT INTO group_messages (group_id, sender_id, content, timestamp)
		VALUES (?, ?, ?, ?)
	`, msg.GroupID, msg.From, msg.Content, time.Now())
	return err
}

// repository/message_repository.go
func (r *ChatRepository) GetGroupMembers(groupID int) ([]models.GroupMember, error) {
	// First get the creator's information
	var creatorID int
	var creator models.GroupMember
	err := r.DB.QueryRow(`
        SELECT creator_id FROM groups WHERE id = ?
    `, groupID).Scan(&creatorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group creator: %w", err)
	}

	// Get creator details if they exist in users table
	err = r.DB.QueryRow(`
        SELECT 
            id,
            COALESCE(nickname, first_name || ' ' || last_name) as username,
            avatar
        FROM users 
        WHERE id = ?
    `, creatorID).Scan(
		&creator.ID,
		&creator.Username,
		&creator.Avatar,
	)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to get creator details: %w", err)
	}

	// Set creator role and joined_at (use group creation time as joined_at)
	if creator.ID != 0 { // Only if creator exists in users table
		creator.Role = "creator"
		creator.JoinedAt = time.Now().Format(time.RFC3339) // Or get actual group creation time
	}

	// Get regular members (including creator if they're still a member)
	rows, err := r.DB.Query(`
        SELECT 
            u.id, 
            COALESCE(u.nickname, u.first_name || ' ' || u.last_name) as username,
            u.avatar,
            CASE 
                WHEN g.creator_id = gm.user_id THEN 'creator' 
                ELSE 'member' 
            END as role,
            gm.created_at as joined_at
        FROM group_memberships gm
        JOIN users u ON gm.user_id = u.id
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.group_id = ? AND gm.status = 'accepted'
        ORDER BY 
            CASE WHEN g.creator_id = gm.user_id THEN 0 ELSE 1 END,
            gm.created_at
    `, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}
	defer rows.Close()

	var members []models.GroupMember
	// Add creator first if they exist
	if creator.ID != 0 {
		members = append(members, creator)
	}

	// Add other members
	for rows.Next() {
		var member models.GroupMember
		var joinedAt time.Time

		err := rows.Scan(
			&member.ID,
			&member.Username,
			&member.Avatar,
			&member.Role,
			&joinedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}

		// Skip creator if they're also in members table (to avoid duplicate)
		if member.ID != creatorID {
			member.JoinedAt = joinedAt.Format(time.RFC3339)
			members = append(members, member)
		}
	}

	return members, nil
}

func (r *ChatRepository) CheckPrivateProfileAccess(senderID, recipientID int) (bool, error) {
	if senderID == recipientID {
		return true, nil
	}

	var isPrivate bool
	err := r.DB.QueryRow(`
		SELECT is_private FROM users WHERE id = ?
	`, recipientID).Scan(&isPrivate)
	if err != nil {
		return false, err
	}

	if !isPrivate {
		return true, nil
	}

	var status string
	err = r.DB.QueryRow(`
		SELECT status FROM followers 
		WHERE follower_id = ? AND followed_id = ? AND status = 'accepted'
	`, senderID, recipientID).Scan(&status)

	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return status == "accepted", nil
}
