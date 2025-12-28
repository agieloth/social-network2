package repositories

import (
	"database/sql"
	"fmt"
	"social/models"
	"time"
)

type GroupRepository struct {
	db *sql.DB
}

func NewGroupRepository(db *sql.DB) *GroupRepository {
	return &GroupRepository{db: db}
}
func (r *GroupRepository) GetGroupDetailsByID(groupID, userID int) (*models.GroupResponse, error) {
	query := `
	SELECT 
		g.id, g.title, g.description, g.creator_id, g.created_at,
		(SELECT COUNT(*) FROM group_memberships WHERE group_id = g.id AND status = 'accepted') AS member_count,
		EXISTS(SELECT 1 FROM group_memberships WHERE group_id = g.id AND user_id = ? AND status = 'accepted') AS is_member,
		(g.creator_id = ?) AS is_creator,
		EXISTS(SELECT 1 FROM group_memberships WHERE group_id = g.id AND user_id = ? AND status = 'pending') AS is_pending
	FROM groups g
	WHERE g.id = ?
`


	var resp models.GroupResponse
	err := r.db.QueryRow(query, userID, userID, userID, groupID).Scan(
		&resp.ID,
		&resp.Title,
		&resp.Description,
		&resp.CreatorID,
		&resp.CreatedAt,
		&resp.MemberCount,
		&resp.IsMember,
		&resp.IsCreator,
		&resp.IsPending,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("Group not found")
		}
		return nil, err
	}

	return &resp, nil
}

func (r *GroupRepository) GetGroupCreatorID(groupID int) (int, error) {
	var creatorID int
	err := r.db.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		return 0, err
	}
	return creatorID, nil
}

func (r *GroupRepository) GetMembershipStatus(groupID, userID int) (string, error) {
	var status string
	err := r.db.QueryRow("SELECT status FROM group_memberships WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&status)
	if err != nil {
		return "", err
	}
	return status, nil
}

func (r *GroupRepository) GetPendingRequests(groupID int) ([]models.PendingRequest, error) {
	rows, err := r.db.Query(`
        SELECT 
            gm.id as request_id,
            u.id as user_id,
            u.nickname,
            u.avatar,
            gm.created_at as requested_at
        FROM group_memberships gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.status = 'pending'
        ORDER BY gm.created_at DESC
    `, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []models.PendingRequest
	for rows.Next() {
		var req models.PendingRequest
		var createdAt time.Time
		err := rows.Scan(
			&req.RequestID,
			&req.UserID,
			&req.Username,
			&req.Avatar,
			&createdAt,
		)
		if err != nil {
			return nil, err
		}
		req.RequestedAt = createdAt.Format(time.RFC3339)
		requests = append(requests, req)
	}

	return requests, nil
}

func (r *GroupRepository) CheckMembershipExists(groupID, userID int) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND user_id = ?`, groupID, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *GroupRepository) CreateJoinRequest(groupID, userID int) error {
	_, err := r.db.Exec(`
		INSERT INTO group_memberships (group_id, user_id, status)
		VALUES (?, ?, 'pending')`, groupID, userID)
	return err
}

func (r *GroupRepository) UpdateMembershipStatus(groupID, userID int, status string) error {
	_, err := r.db.Exec(`
		UPDATE group_memberships 
		SET status = ? 
		WHERE group_id = ? AND user_id = ?`, status, groupID, userID)
	return err
}

func (r *GroupRepository) DeleteMembership(groupID, userID int) error {
	_, err := r.db.Exec(`
		DELETE FROM group_memberships
		WHERE group_id = ? AND user_id = ?`, groupID, userID)
	return err
}

func (r *GroupRepository) UpsertGroupInvitation(groupID, userID int) error {
	_, err := r.db.Exec(`
		INSERT INTO group_memberships (group_id, user_id, status)
		VALUES (?, ?, 'invited')
		ON CONFLICT(group_id, user_id) DO UPDATE SET status='invited'`, groupID, userID)
	return err
}

func (r *GroupRepository) ApproveMembershipRequest(groupID, userID int) error {
	_, err := r.db.Exec(`
		UPDATE group_memberships
		SET status = 'accepted'
		WHERE group_id = ? AND user_id = ? AND status = 'pending'`, groupID, userID)
	return err
}

func (r *GroupRepository) DeclineMembershipRequest(groupID, userID int) error {
	_, err := r.db.Exec(`
		DELETE FROM group_memberships
		WHERE group_id = ? AND user_id = ? AND status = 'pending'`, groupID, userID)
	return err
}

func (r *GroupRepository) GetNonGroupMembers(groupID, userID int) ([]map[string]interface{}, error) {
	query := `
		SELECT id, nickname FROM users
		WHERE id NOT IN (
			-- Exclure le créateur du groupe
			SELECT creator_id FROM groups WHERE id = ?
			UNION
			-- Exclure tous les utilisateurs qui ont une relation avec le groupe
			-- (membres acceptés, invitations en attente, demandes en attente)
			SELECT user_id FROM group_memberships WHERE group_id = ?
			UNION
			-- Exclure l'utilisateur qui fait la requête
			SELECT ?
		)
		ORDER BY nickname`

	rows, err := r.db.Query(query, groupID, groupID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var username string
		if err := rows.Scan(&id, &username); err != nil {
			return nil, err
		}
		users = append(users, map[string]interface{}{
			"id":       id,
			"username": username,
		})
	}

	return users, nil
}

func (r *GroupRepository) GetGroupPosts(groupID, userID int) ([]models.GroupPost, error) {
	// Check if user is member or creator of the group
	var memberExists int
	err := r.db.QueryRow(`
		SELECT 1 FROM group_memberships
		WHERE group_id = ? AND user_id = ? AND status = 'accepted'
		UNION
		SELECT 1 FROM groups WHERE id = ? AND creator_id = ?`,
		groupID, userID, groupID, userID).Scan(&memberExists)
	if err != nil {
		return nil, err
	}
	if memberExists == 0 {
		return nil, fmt.Errorf("user not authorized")
	}

	rows, err := r.db.Query(`
		SELECT gp.id, gp.group_id, gp.author_id, gp.content, gp.image, gp.created_at,
			   u.nickname as author_name, u.avatar as avatar,
			   COUNT(gpc.id) as comments_count
		FROM group_posts gp
		JOIN users u ON gp.author_id = u.id
		LEFT JOIN group_post_comments gpc ON gp.id = gpc.post_id
		WHERE gp.group_id = ?
		GROUP BY gp.id
		ORDER BY gp.created_at DESC`,
		groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []models.GroupPost
	for rows.Next() {
		var post models.GroupPost
		if err := rows.Scan(
			&post.ID, &post.GroupID, &post.AuthorID, &post.Content, &post.Image, &post.CreatedAt,
			&post.AuthorName, &post.AuthorAvatar, &post.CommentsCount,
		); err != nil {
			return nil, err
		}

		if post.AuthorAvatar != "" {
			post.AuthorAvatar = "http://localhost:8080/" + post.AuthorAvatar
		}

		posts = append(posts, post)
	}

	return posts, nil
}

func (r *GroupRepository) IsGroupMember(groupID, userID int) (bool, error) {
	var exists int
	err := r.db.QueryRow(`
		SELECT COUNT(*)
		FROM groups g
		LEFT JOIN group_memberships gm ON g.id = gm.group_id AND gm.user_id = ? AND gm.status = 'accepted'
		WHERE g.id = ? AND (g.creator_id = ? OR gm.id IS NOT NULL)
	`, userID, groupID, userID).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}


func (r *GroupRepository) CreateGroupPost(post models.GroupPost) (*models.GroupPost, error) {
	result, err := r.db.Exec(`
		INSERT INTO group_posts (group_id, author_id, content, image, created_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		post.GroupID, post.AuthorID, post.Content, post.Image)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	// Retrieve full post details including author info
	var fullPost models.GroupPost
	err = r.db.QueryRow(`
		SELECT gp.id, gp.group_id, gp.author_id, gp.content, gp.image, gp.created_at,
		       u.nickname as author_name, u.avatar as author_avatar
		FROM group_posts gp
		JOIN users u ON gp.author_id = u.id
		WHERE gp.id = ?`, id).Scan(
		&fullPost.ID, &fullPost.GroupID, &fullPost.AuthorID, &fullPost.Content,
		&fullPost.Image, &fullPost.CreatedAt, &fullPost.AuthorName, &fullPost.AuthorAvatar,
	)
	if err != nil {
		return nil, err
	}

	// Prepend avatar URL if exists
	if fullPost.AuthorAvatar != "" {
		fullPost.AuthorAvatar = "http://localhost:8080/" + fullPost.AuthorAvatar
	}

	return &fullPost, nil
}

func (r *GroupRepository) GetGroupPostComments(postID, userID int) ([]models.GroupPostComment, error) {
	// Verify user has access to the group post
	var groupID int
	err := r.db.QueryRow(`SELECT group_id FROM group_posts WHERE id = ?`, postID).Scan(&groupID)
	if err != nil {
		return nil, err
	}

	var memberCount int
	err = r.db.QueryRow(`
		SELECT COUNT(*) FROM (
			SELECT 1 FROM group_memberships
			WHERE group_id = ? AND user_id = ? AND status = 'accepted'
			UNION
			SELECT 1 FROM groups WHERE id = ? AND creator_id = ?
		)`, groupID, userID, groupID, userID).Scan(&memberCount)

	if err != nil || memberCount == 0 {
		// User not authorized, return empty slice, no error
		return []models.GroupPostComment{}, nil
	}

	rows, err := r.db.Query(`
		SELECT gpc.id, gpc.post_id, gpc.author_id, gpc.content, gpc.created_at,
			   u.nickname as author_name, u.avatar as avatar
		FROM group_post_comments gpc
		JOIN users u ON gpc.author_id = u.id
		WHERE gpc.post_id = ?
		ORDER BY gpc.created_at ASC`,
		postID)
	if err != nil {
		return []models.GroupPostComment{}, err
	}
	defer rows.Close()

	var comments []models.GroupPostComment
	for rows.Next() {
		var comment models.GroupPostComment
		err := rows.Scan(
			&comment.ID, &comment.PostID, &comment.AuthorID, &comment.Content, &comment.CreatedAt,
			&comment.AuthorName, &comment.AuthorAvatar,
		)
		if err != nil {
			return nil, err
		}

		if comment.AuthorAvatar != "" {
			comment.AuthorAvatar = "http://localhost:8080/" + comment.AuthorAvatar
		}

		comments = append(comments, comment)
	}

	return comments, nil
}

func (r *GroupRepository) CreateGroupPostComment(comment models.GroupPostComment) (models.GroupPostComment, error) {
	result, err := r.db.Exec(`
		INSERT INTO group_post_comments (post_id, author_id, content)
		VALUES (?, ?, ?)`,
		comment.PostID, comment.AuthorID, comment.Content)
	if err != nil {
		return models.GroupPostComment{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.GroupPostComment{}, err
	}

	comment.ID = int(id)
	comment.CreatedAt = time.Now()

	return comment, nil
}

func (r *GroupRepository) GetGroupPostCommentByID(commentID int) (models.GroupPostComment, error) {
	var comment models.GroupPostComment
	err := r.db.QueryRow(`
		SELECT gpc.id, gpc.post_id, gpc.author_id, gpc.content, gpc.created_at,
			   u.nickname as author_name, u.avatar as author_avatar
		FROM group_post_comments gpc
		JOIN users u ON gpc.author_id = u.id
		WHERE gpc.id = ?`, commentID).Scan(
		&comment.ID, &comment.PostID, &comment.AuthorID, &comment.Content,
		&comment.CreatedAt, &comment.AuthorName, &comment.AuthorAvatar,
	)

	if err != nil {
		return models.GroupPostComment{}, err
	}

	if comment.AuthorAvatar != "" {
		comment.AuthorAvatar = "http://localhost:8080/" + comment.AuthorAvatar
	}

	return comment, nil
}

func (r *GroupRepository) GetGroupEvents(groupID, userID int) ([]models.GroupEvent, error) {

	// Step 2: Fetch events
	rows, err := r.db.Query(`
	SELECT 
		ge.id, ge.group_id, ge.creator_id, ge.title, ge.description,
		ge.event_date, ge.created_at,
		u.first_name || ' ' || u.last_name as creator_name,
		-- going count
		(SELECT COUNT(*) FROM event_responses er1 WHERE er1.event_id = ge.id AND er1.response = 'going') AS going_count,
		-- not going count
		(SELECT COUNT(*) FROM event_responses er2 WHERE er2.event_id = ge.id AND er2.response = 'not_going') AS not_going_count,
		-- user's response
		(SELECT er3.response FROM event_responses er3 WHERE er3.event_id = ge.id AND er3.user_id = ?) AS user_response
	FROM group_events ge
	JOIN users u ON ge.creator_id = u.id
	WHERE ge.group_id = ?
	ORDER BY ge.event_date ASC
`, userID, groupID)

	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var events []models.GroupEvent
	for rows.Next() {
		var event models.GroupEvent
		var userResponse sql.NullString

		if err := rows.Scan(
			&event.ID, &event.GroupID, &event.CreatorID, &event.Title, &event.Description,
			&event.EventDate, &event.CreatedAt, &event.CreatorName,
			&event.GoingCount, &event.NotGoingCount, &userResponse,
		); err != nil {
			return nil, err
		}

		if userResponse.Valid {
			event.UserResponse = userResponse.String
		}

		events = append(events, event)

	}

	return events, nil
}

func (r *GroupRepository) CreateGroupEvent(event models.GroupEvent) (models.GroupEvent, error) {
	result, err := r.db.Exec(`
		INSERT INTO group_events (group_id, creator_id, title, description, event_date)
		VALUES (?, ?, ?, ?, ?)`,
		event.GroupID, event.CreatorID, event.Title, event.Description, event.EventDate)
	if err != nil {
		return models.GroupEvent{}, fmt.Errorf("insert failed: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.GroupEvent{}, fmt.Errorf("failed to get inserted id: %w", err)
	}

	event.ID = int(id)
	event.CreatedAt = time.Now()
	return event, nil
}

func (r *GroupRepository) GetGroupEventWithCreator(eventID int) (models.GroupEvent, error) {
	var event models.GroupEvent

	err := r.db.QueryRow(`
		SELECT ge.id, ge.group_id, ge.creator_id, ge.title, ge.description,
			   ge.event_date, ge.created_at,
			   u.first_name || ' ' || u.last_name as creator_name
		FROM group_events ge
		JOIN users u ON ge.creator_id = u.id
		WHERE ge.id = ?`, eventID).Scan(
		&event.ID, &event.GroupID, &event.CreatorID, &event.Title,
		&event.Description, &event.EventDate, &event.CreatedAt, &event.CreatorName,
	)
	if err != nil {
		return models.GroupEvent{}, fmt.Errorf("event lookup failed: %w", err)
	}

	return event, nil
}

func (r *GroupRepository) InsertGroupMessage(groupID int, senderID int, content string) (int, error) {
	result, err := r.db.Exec(`
		INSERT INTO group_messages (group_id, sender_id, content, timestamp)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
		groupID, senderID, content,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert group message: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get message ID: %w", err)
	}

	return int(id), nil
}

func (r *GroupRepository) GetAllGroups(userID int) ([]models.GroupWithStatus, error) {
	query := `
        SELECT 
            g.id, g.title, g.description, g.creator_id,
            COUNT(gm.user_id) as member_count,
            EXISTS(
                SELECT 1 FROM group_memberships 
                WHERE group_id = g.id AND user_id = ? AND status = 'accepted'
            ) as is_member,
            g.creator_id = ? as is_creator,
            EXISTS(
                SELECT 1 FROM group_memberships 
                WHERE group_id = g.id AND user_id = ? AND status = 'pending'
            ) as is_pending
        FROM groups g
        LEFT JOIN group_memberships gm ON g.id = gm.group_id AND gm.status = 'accepted'
        GROUP BY g.id
    `
	rows, err := r.db.Query(query, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.GroupWithStatus
	for rows.Next() {
		var g models.GroupWithStatus
		err := rows.Scan(
			&g.ID, &g.Title, &g.Description, &g.CreatorID,
			&g.MemberCount, &g.IsMember, &g.IsCreator, &g.IsPending,
		)
		if err != nil {
			continue
		}
		groups = append(groups, g)
	}
	return groups, nil
}

func (r *GroupRepository) CreateGroup(group models.Group) (models.Group, error) {
	result, err := r.db.Exec(`
        INSERT INTO groups (title, description, creator_id)
        VALUES (?, ?, ?)`,
		group.Name, group.Description, group.OwnerID)
	if err != nil {
		return models.Group{}, err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return models.Group{}, err
	}
	
	group.ID = int(id)
	return group, nil
}

// Add this to your existing repository methods
func (r *GroupRepository) SetEventResponse(eventID, userID int, response string) error {
    // First check if response exists
    var exists bool
    err := r.db.QueryRow(`
        SELECT EXISTS(
            SELECT 1 FROM event_responses 
            WHERE event_id = ? AND user_id = ?
        )`, eventID, userID).Scan(&exists)
    if err != nil {
        return fmt.Errorf("check existing response failed: %w", err)
    }

    if exists {
        // Update existing response
        _, err = r.db.Exec(`
            UPDATE event_responses 
            SET response = ?
            WHERE event_id = ? AND user_id = ?`,
            response, eventID, userID)
    } else {
        // Insert new response
        _, err = r.db.Exec(`
            INSERT INTO event_responses (event_id, user_id, response)
            VALUES (?, ?, ?)`,
            eventID, userID, response)
    }

    if err != nil {
        return fmt.Errorf("failed to set event response: %w", err)
    }

    return nil
}

func (r *GroupRepository) GetGroupMembers(groupID int) ([]models.GroupMember, error) {
    query := `
        SELECT 
            u.id,
            u.nickname,
            u.avatar,
            CASE 
                WHEN g.creator_id = u.id THEN 'creator'
                ELSE 'member'
            END as role,
            gm.created_at as joined_at
        FROM group_memberships gm
        JOIN users u ON gm.user_id = u.id
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.group_id = ? AND gm.status = 'accepted'
        UNION
        SELECT 
            u.id,
            u.nickname,
            u.avatar,
            'creator' as role,
            g.created_at as joined_at
        FROM groups g
        JOIN users u ON g.creator_id = u.id
        WHERE g.id = ?
        ORDER BY role DESC, joined_at ASC
    `

    rows, err := r.db.Query(query, groupID, groupID)
    if err != nil {
        return nil, fmt.Errorf("failed to query group members: %w", err)
    }
    defer rows.Close()

    var members []models.GroupMember
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
            return nil, fmt.Errorf("failed to scan member row: %w", err)
        }
        
        member.JoinedAt = joinedAt.Format(time.RFC3339)
        if member.Avatar != "" {
            member.Avatar = "http://localhost:8080/" + member.Avatar
        }
        
        members = append(members, member)
    }

    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("rows iteration error: %w", err)
    }

    return members, nil
}

func (r *GroupRepository) GroupExists(groupID int) (bool, error) {
    var exists bool
    err := r.db.QueryRow("SELECT EXISTS(SELECT 1 FROM groups WHERE id = ?)", groupID).Scan(&exists)
    return exists, err
}

func (r *GroupRepository) GetGroupChatHistory(groupID int, limit int) ([]models.GroupMessage, error) {
    query := `
        SELECT 
            gm.id, 
            gm.group_id, 
            gm.sender_id, 
            gm.content, 
            gm.timestamp,
            u.nickname as sender_nickname,
            u.avatar as sender_avatar
        FROM group_messages gm
        JOIN users u ON gm.sender_id = u.id
        WHERE gm.group_id = ?
        ORDER BY gm.timestamp DESC
        LIMIT ?
    `

    rows, err := r.db.Query(query, groupID, limit)
    if err != nil {
        return nil, fmt.Errorf("failed to query group chat history: %w", err)
    }
    defer rows.Close()

    var messages []models.GroupMessage
    for rows.Next() {
        var msg models.GroupMessage
        var timestamp time.Time
        
        err := rows.Scan(
            &msg.ID,
            &msg.GroupID,
            &msg.SenderID,
            &msg.Content,
            &timestamp,
            &msg.SenderNickname,
            &msg.SenderAvatar,
        )
        if err != nil {
            return nil, fmt.Errorf("failed to scan message row: %w", err)
        }
        
        msg.Timestamp = timestamp
        if msg.SenderAvatar != "" {
            msg.SenderAvatar = "http://localhost:8080/" + msg.SenderAvatar
        }
        
        messages = append(messages, msg)
    }

    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("rows iteration error: %w", err)
    }

    // Reverse the order to have oldest messages first
    for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
        messages[i], messages[j] = messages[j], messages[i]
    }

    return messages, nil
}

func (r *GroupRepository) CreateNotification(recipientID int, notification models.Notification) (int, error) {
    var id int64
    
    result, err := r.db.Exec(`
        INSERT INTO notifications (
            user_id, 
            sender_id, 
            group_id,
			event_id,
            type, 
            message, 
            seen, 
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        recipientID,
        notification.SenderID,
        notification.GroupId, // Can be nil
        notification.EventId, // Can be nil
        notification.Type,
        notification.Message,
        notification.Seen,
        notification.CreatedAt,
    )
    
    if err != nil {
        return 0, fmt.Errorf("failed to create notification: %w", err)
    }
    
    id, err = result.LastInsertId()
    if err != nil {
        return 0, fmt.Errorf("failed to get last insert ID: %w", err)
    }
    
    return int(id), nil
}

func (r *GroupRepository) GetUserNickname(userID int) (string, error) {
    var nickname string
    err := r.db.QueryRow("SELECT nickname FROM users WHERE id = ?", userID).Scan(&nickname)
    if err != nil {
        return "", fmt.Errorf("failed to get user nickname: %w", err)
    }
    return nickname, nil
}


// IsUserMemberOfGroup vérifie si un utilisateur est un membre accepté du groupe OU le créateur
func (r *GroupRepository) IsUserMemberOfGroup(groupID, userID int) (bool, error) {
	// Vérifier si l'utilisateur est le créateur du groupe
	var creatorID int
	err := r.db.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, groupID).Scan(&creatorID)
	if err != nil {
		return false, err
	}
	
	// Si c'est le créateur, retourner true
	if creatorID == userID {
		return true, nil
	}
	
	// Sinon, vérifier si c'est un membre accepté
	var count int
	err = r.db.QueryRow(`
		SELECT COUNT(*) 
		FROM group_memberships 
		WHERE group_id = ? AND user_id = ? AND status = 'accepted'
	`, groupID, userID).Scan(&count)
	
	if err != nil {
		return false, err
	}
	
	return count > 0, nil
}