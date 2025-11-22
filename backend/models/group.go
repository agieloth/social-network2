package models

import "time"

type Group struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     int       `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type GroupResponse struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatorID   int    `json:"creator_id"`
	CreatedAt   string `json:"created_at"`
	MemberCount int    `json:"member_count"`
	IsMember    bool   `json:"is_member"`
	IsCreator   bool   `json:"is_creator"`
	IsPending   bool   `json:"is_pending"`
}

type PendingRequest struct {
	RequestID   int    `json:"request_id"`
	UserID      int    `json:"user_id"`
	Username    string `json:"username"`
	Avatar      string `json:"avatar"`
	RequestedAt string `json:"requested_at"`
}

type InviteRequest struct {
	UserID int `json:"user_id"`
}

type ApproveRequest struct {
	UserID int `json:"user_id"`
}

type DeclineRequest struct {
	UserID int `json:"user_id"`
}

type GroupPost struct {
	ID        int       `json:"id"`
	GroupID   int       `json:"group_id"`
	AuthorID  int       `json:"author_id"`
	Content   string    `json:"content"`
	Image     string    `json:"image"`
	CreatedAt time.Time `json:"created_at"`

	// Champs calculés (join avec d'autres tables)
	AuthorName    string `json:"author_name"`
	AuthorAvatar  string `json:"author_avatar"`
	CommentsCount int    `json:"comments_count"`
}

type GroupPostComment struct {
	ID        int       `json:"id"`
	PostID    int       `json:"post_id"`
	AuthorID  int       `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`

	// Champs calculés
	AuthorName   string `json:"author_name"`
	AuthorAvatar string `json:"author_avatar"`
}

type CreateCommentRequest struct {
	PostID  int    `json:"post_id"`
	Content string `json:"content"`
}

type CreateEventRequest struct {
	GroupID     int    `json:"group_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	EventDate   string `json:"event_date"` // RFC3339
}

type GroupMember struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
	Role     string `json:"role"` // "creator" or "member"
	JoinedAt string `json:"joined_at"`
}

type GroupEvent struct {
	ID            int       `json:"id"`
	GroupID       int       `json:"group_id"`
	CreatorID     int       `json:"creator_id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	EventDate     time.Time `json:"event_date"`
	CreatedAt     time.Time `json:"created_at"`
	CreatorName   string    `json:"creator_name"`
	GoingCount    int       `json:"going_count,omitempty"`
	NotGoingCount int       `json:"not_going_count,omitempty"`
	UserResponse  string    `json:"user_response,omitempty"`
}

type Message struct {
	From      int    `json:"from"` // Changed to lowercase to match frontend
	To        int    `json:"to"`
	GroupID   int    `json:"groupId"` // Changed to match frontend's groupId
	Content   string `json:"content"`
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
}

type GroupMessage struct {
	ID             int       `json:"id"`
	GroupID        int       `json:"group_id"`
	SenderID       int       `json:"sender_id"`
	Content        string    `json:"content"`
	Timestamp      time.Time `json:"timestamp"`
	SenderNickname string    `json:"sender_nickname"`
	SenderAvatar   string    `json:"sender_avatar"`
}

type GroupWithStatus struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatorID   int    `json:"creator_id"`

	MemberCount int  `json:"member_count"`
	IsMember    bool `json:"is_member"`
	IsCreator   bool `json:"is_creator"`
	IsPending   bool `json:"is_pending"`
}

type CreateGroupRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}
