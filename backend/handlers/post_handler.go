// handlers/post_handler.go
package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

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
	idStr := strings.TrimPrefix(r.URL.Path, "/api/user-posts/")
	userID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	currentUser, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	posts, err := h.service.GetUserPosts(userID, currentUser)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Could not fetch posts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(posts)
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
	fmt.Println("here")
	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "Invalid form", http.StatusBadRequest)
		return
	}

	content := r.FormValue("content")
	privacy := r.FormValue("privacy")
	recipientIDsStr := r.Form["recipient_ids"]

	fmt.Println("reciepents are : ", recipientIDsStr)

	if content == "" || privacy == "" {
		http.Error(w, "Missing content or privacy", http.StatusBadRequest)
		return
	}

	var imageURL string
	file, header, err := r.FormFile("image")
	if err == nil && header != nil {
		defer file.Close()
		filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), header.Filename)
		dst := fmt.Sprintf("uploads/%s", filename)
		outFile, err := os.Create(dst)
		if err != nil {
			http.Error(w, "Could not save image", http.StatusInternalServerError)
			return
		}
		defer outFile.Close()
		_, err = io.Copy(outFile, file)
		if err != nil {
			http.Error(w, "Could not write image", http.StatusInternalServerError)
			return
		}
		imageURL = "/uploads/" + filename
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
		http.Error(w, "Failed to create post", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *PostHandler) GetPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	posts, err := h.service.GetPostsForUser(userID)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Could not fetch posts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(posts)
}

func (h *PostHandler) CreateCommentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Non autorisé", http.StatusUnauthorized)
		return
	}

	// Parse multipart form (required before accessing FormValue or FormFile)
	err := r.ParseMultipartForm(10 << 20) // 10MB limit
	if err != nil {
		http.Error(w, "Formulaire invalide", http.StatusBadRequest)
		return
	}

	postID := r.FormValue("post_id")
	if postID == "" {
		http.Error(w, "Post ID requis", http.StatusBadRequest)
		return
	}

	content := r.FormValue("content")

	file, fileHeader, err := r.FormFile("image")
	var image string
	if err == nil {
		defer file.Close()

		// Validate image format
		if err := utils.IsValidImage(fileHeader); err != nil {
			http.Error(w, "Format image non supporté", http.StatusBadRequest)
			return
		}

		// Save image file (you can move this logic to a helper if you want)
		filename := utils.GenerateFilename(fileHeader.Filename)
		dstPath := filepath.Join("uploads", filename)
		dst, err := os.Create(dstPath)
		if err != nil {
			http.Error(w, "Erreur serveur", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		_, err = io.Copy(dst, file)
		if err != nil {
			http.Error(w, "Erreur lors de l'enregistrement de l'image", http.StatusInternalServerError)
			return
		}

		image = "/uploads/" + filename
	}

	if content == "" && image == "" {
		http.Error(w, "Le commentaire ne peut pas être vide", http.StatusBadRequest)
		return
	}

	err = h.service.CreateComment(postID, userID, content, image)
	if err != nil {
		http.Error(w, "Erreur base de données", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	fmt.Fprint(w, "Commentaire ajouté avec succès")
}

func (h *PostHandler) GetCommentsByPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}

	postID := r.URL.Query().Get("id")
	if postID == "" {
		http.Error(w, "ID du post manquant", http.StatusBadRequest)
		return
	}

	comments, err := h.service.GetCommentsByPost(postID)
	if err != nil {
		http.Error(w, "Erreur base de données", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(comments)
}
