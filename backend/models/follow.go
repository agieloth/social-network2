package models


type FollowRequest struct {
	FollowerID int
	FollowedID int
	Status     string
}

type FollowStatus struct {
	Status string `json:"status"`
}

type FollowActionRequest struct {
	SenderID int `json:"sender_id"`
}

type Follower struct {
	ID        int
	FirstName string
	LastName  string
	Nickname  string
	Avatar    string
}

type Following struct {
	ID        int
	Nickname  string
	FirstName string
	LastName  string
	Avatar    string
}