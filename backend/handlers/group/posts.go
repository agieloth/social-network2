package group

import (
	"fmt"
	"net/http"
	"strconv"

	"social/models"
	"social/services"
	"social/utils"
)

type PostsHandler struct {
	Service *services.GroupService
	Session *services.SessionService
}

func NewPostsHandler(service *services.GroupService, session *services.SessionService) *PostsHandler {
	return &PostsHandler{
		Service: service,
		Session: session,
	}
}

// GetPosts récupère les posts d'un groupe
func (h *PostsHandler) GetPosts(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/posts")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	posts, err := h.Service.GetGroupPosts(groupID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch posts")
		return
	}

	utils.WriteJSON(w, http.StatusOK, posts)
}

// CreatePost crée un nouveau post dans le groupe
func (h *PostsHandler) CreatePost(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/posts")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
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

	content := r.FormValue("content")
	if content == "" {
		utils.WriteError(w, http.StatusBadRequest, "Content is required")
		return
	}

	// Upload image optionnel
	imageURL, err := utils.HandleOptionalFileUpload(
		r,
		"image",
		utils.DefaultImageUploadConfig("uploads/group_posts"),
	)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to upload image: "+err.Error())
		return
	}

	post := models.GroupPost{
		GroupID:  groupID,
		AuthorID: userID,
		Content:  content,
		Image:    imageURL,
	}

	createdPost, err := h.Service.CreateGroupPost(post)
	if err != nil {
		fmt.Println("Error creating post:", err)
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create post")
		return
	}

	utils.WriteJSON(w, http.StatusCreated, createdPost)
}

// GetComments récupère les commentaires d'un post
func (h *PostsHandler) GetComments(w http.ResponseWriter, r *http.Request) {
	postIDStr := r.URL.Query().Get("post_id")
	if postIDStr == "" {
		utils.WriteError(w, http.StatusBadRequest, "Missing post_id parameter")
		return
	}

	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid post_id")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	comments, err := h.Service.GetGroupPostComments(postID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch comments")
		return
	}

	utils.WriteJSON(w, http.StatusOK, comments)
}

// CreateComment crée un nouveau commentaire sur un post
func (h *PostsHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := utils.ParseMultipartFormSafe(r, 10<<20); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid form")
		return
	}

	postIDStr := r.FormValue("post_id")
	if postIDStr == "" {
		utils.WriteError(w, http.StatusBadRequest, "Post ID is required")
		return
	}

	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid post ID")
		return
	}

	content := r.FormValue("content")
	if content == "" {
		utils.WriteError(w, http.StatusBadRequest, "Content is required")
		return
	}

	comment, err := h.Service.CreateGroupPostComment(userID, postID, content)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create comment")
		return
	}

	utils.WriteJSON(w, http.StatusCreated, comment)
}

// HandlePostComments gère GET et POST sur /groups/{id}/posts/{postID}/comments
func (h *PostsHandler) HandlePostComments(w http.ResponseWriter, r *http.Request, method string) {
	switch method {
	case http.MethodGet:
		h.GetComments(w, r)
	case http.MethodPost:
		h.CreateComment(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}