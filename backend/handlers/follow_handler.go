package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"social/hub"
	"social/services"
	"strconv"
	"strings"
)

type FollowHandler struct {
	Service *services.FollowService
	session *services.SessionService
	hub     *hub.Hub
}

func NewFollowHandler(s *services.FollowService, session *services.SessionService, hub *hub.Hub) *FollowHandler {
	return &FollowHandler{Service: s, session: session, hub: hub}
}

func (h *FollowHandler) SendFollowRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		FollowedID int `json:"followed_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	notification, status, err := h.Service.SendFollowRequest(userID, req.FollowedID)
	if err != nil {
		http.Error(w, "Error sending follow request", http.StatusInternalServerError)
		return
	}

	if status == "already_following" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": status})
		return
	}
	if status == "pending" && h.hub != nil {
		h.hub.SendNotification(notification, req.FollowedID)
	}

	w.WriteHeader(http.StatusCreated)
	fmt.Fprint(w, "Follow request sent")
}

func (h *FollowHandler) GetFollowStatus(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/follow/status/")
	followedID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	followerID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	status, err := h.Service.GetFollowStatus(followerID, followedID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]string{
		"status": status,
	})
}

func (h *FollowHandler) AcceptFollow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		SenderID int `json:"sender_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := h.Service.AcceptFollowRequest(req.SenderID, userID); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Optional: trigger real-time updates
	// h.hub.NotifyFollowStatusUpdate(req.SenderID, userID)

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Follow accepté")
}

func (h *FollowHandler) RejectFollow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		SenderID int `json:"sender_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := h.Service.RejectFollowRequest(req.SenderID, userID); err != nil {
		fmt.Println("error 1 : ", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Follow refusé")
}

func (h *FollowHandler) UnfollowUser(w http.ResponseWriter, r *http.Request) {
	sessionUserID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	var payload struct {
		FollowedID int `json:"followed_id"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		fmt.Println("called : ", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	err := h.Service.UnfollowUser(sessionUserID, payload.FollowedID)
	if err != nil {
		fmt.Println("called : ", err)
		http.Error(w, "Error unfollowing user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Unfollowed successfully"))
}

func (h *FollowHandler) GetFollowersHandler(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from URL path: /api/users-followers/{id}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID, err := strconv.Atoi(parts[3])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Call service layer to get followers
	followers, err := h.Service.GetFollowers(userID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// Respond with JSON
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(followers)
}

func (h *FollowHandler) GetFollowingHandler(w http.ResponseWriter, r *http.Request) {
	// Parse user ID from URL path /api/users-following/{id}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userIDStr := parts[len(parts)-1]
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Call service layer
	following, err := h.Service.GetFollowing(userID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// Respond with JSON
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(following)
}

func (h *FollowHandler) GetRecipientsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.session.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	recipients, err := h.Service.GetAcceptedFollowers(userID)
	if err != nil {
		http.Error(w, "Failed to fetch recipients", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(recipients)
}
