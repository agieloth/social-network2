package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"social/services"
	"social/utils"
)

type PostHandler struct {
	service *services.PostService
	session *services.SessionService
}

func NewPostHandler(service *services.PostService, session *services.SessionService) *PostHandler {
	return &PostHandler{service: service, session: session}
}

func (h *PostHandler) GetUserPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/user-posts/", "")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	currentUser, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	posts, err := h.service.GetUserPosts(userID, currentUser)
	if err != nil {
		fmt.Println(err)
		utils.WriteError(w, http.StatusInternalServerError, "Could not fetch posts")
		return
	}

	utils.WriteJSON(w, http.StatusOK, posts)
}

func (h *PostHandler) PostsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetPostsHandler(w, r)
		return
	case http.MethodPost:
		h.CreatePostHandler(w, r)
		return
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

func (h *PostHandler) CreatePostHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := utils.ParseMultipartFormSafe(r, 10<<20); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid form")
		return
	}

	content := r.FormValue("content")
	privacy := r.FormValue("privacy")
	recipientIDsStr := r.Form["recipient_ids"]

	if content == "" || privacy == "" {
		utils.WriteError(w, http.StatusBadRequest, "Missing content or privacy")
		return
	}

	// Upload image optionnel
	imageURL, err := utils.HandleOptionalFileUpload(
		r,
		"image",
		utils.DefaultImageUploadConfig("uploads"),
	)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to upload image: "+err.Error())
		return
	}

	var recipientIDs []int
	if privacy == "custom" {
		for _, idStr := range recipientIDsStr {
			id, err := strconv.Atoi(idStr)
			if err == nil {
				recipientIDs = append(recipientIDs, id)
			}
		}
	}

	err = h.service.CreatePost(userID, content, imageURL, privacy, recipientIDs)
	if err != nil {
		fmt.Println(err)
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create post")
		return
	}

	utils.WriteSuccess(w, "Post created successfully")
}

func (h *PostHandler) GetPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	posts, err := h.service.GetPostsForUser(userID)
	if err != nil {
		fmt.Println(err)
		utils.WriteError(w, http.StatusInternalServerError, "Could not fetch posts")
		return
	}

	utils.WriteJSON(w, http.StatusOK, posts)
}

func (h *PostHandler) CreateCommentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := utils.ParseMultipartFormSafe(r, 10<<20); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid form")
		return
	}

	postID := r.FormValue("post_id")
	if postID == "" {
		utils.WriteError(w, http.StatusBadRequest, "Post ID required")
		return
	}

	content := r.FormValue("content")

	// Upload image optionnel
	imageURL, err := utils.HandleOptionalFileUpload(
		r,
		"image",
		utils.DefaultImageUploadConfig("uploads"),
	)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to upload image: "+err.Error())
		return
	}

	if content == "" && imageURL == "" {
		utils.WriteError(w, http.StatusBadRequest, "Comment cannot be empty")
		return
	}

	err = h.service.CreateComment(postID, userID, content, imageURL)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteSuccess(w, "Comment added successfully")
}

func (h *PostHandler) GetCommentsByPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	postID := r.URL.Query().Get("id")
	if postID == "" {
		utils.WriteError(w, http.StatusBadRequest, "Post ID missing")
		return
	}

	comments, err := h.service.GetCommentsByPost(postID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, comments)
}
