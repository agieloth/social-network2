package models

import "time"

type Post struct {
	ID        int    `json:"id"`
	Content   string `json:"content"`
	Image     string `json:"image_url"`
	CreatedAt string `json:"created_at"`
}

type PostFetch struct {
    ID           int       `json:"id"`
    AuthorID     int       `json:"author_id"`
	AuthorName   string    `json:"author_name"`
    Content      string    `json:"content"`
    ImageURL     string    `json:"image_url"`
    Privacy      string    `json:"privacy"`
    CreatedAt    time.Time `json:"created_at"`
    AuthorAvatar string    `json:"author_avatar"`
    Recipients   []int     `json:"recipients,omitempty"`
}

type CommentWithUser struct {
	ID        int    `json:"id"`
	Content   string `json:"content"`
	ImageURL  string `json:"image_url"`
	CreatedAt string `json:"created_at"`
	Author    struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Avatar    string `json:"avatar"`
	} `json:"author"`
}