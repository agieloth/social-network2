package models

type Profile struct {
	ID          int    `json:"id"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Nickname    string `json:"nickname"`
	Email       string `json:"email"`
	About       string `json:"about"`
	Avatar      string `json:"avatar"`
	DateOfBirth string `json:"date_of_birth"`
	IsPrivate   bool   `json:"is_private"`

	// Meta info (not stored in DB)
	IsOwner    bool `json:"is_owner"`
	IsFollowed bool `json:"is_followed"`
	IsPending  bool `json:"is_pending"`
}

type SearchResult struct {
	ID        int    `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
}

type PrivacyRequest struct {
	IsPrivate bool `json:"is_private"`
}
