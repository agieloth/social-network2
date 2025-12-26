package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"social/hub"
	"social/services"
	"social/utils"
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

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		FollowedID int `json:"followed_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	notification, status, err := h.Service.SendFollowRequest(userID, req.FollowedID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Error sending follow request")
		return
	}

	if status == "already_following" {
		utils.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
		return
	}
	
	if status == "pending" && h.hub != nil {
		h.hub.SendNotification(notification, req.FollowedID)
	}

	utils.WriteSuccess(w, "Follow request sent")
}

func (h *FollowHandler) GetFollowStatus(w http.ResponseWriter, r *http.Request) {
	followedID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/follow/status/", "")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	followerID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	status, err := h.Service.GetFollowStatus(followerID, followedID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "DB error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
}

func (h *FollowHandler) AcceptFollow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		SenderID int `json:"sender_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.Service.AcceptFollowRequest(req.SenderID, userID); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteSuccess(w, "Follow accepted")
}

func (h *FollowHandler) RejectFollow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		SenderID int `json:"sender_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.Service.RejectFollowRequest(req.SenderID, userID); err != nil {
		fmt.Println("error 1 : ", err)
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteSuccess(w, "Follow rejected")
}

func (h *FollowHandler) UnfollowUser(w http.ResponseWriter, r *http.Request) {
	sessionUserID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var payload struct {
		FollowedID int `json:"followed_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		fmt.Println("called : ", err)
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.UnfollowUser(sessionUserID, payload.FollowedID); err != nil {
		fmt.Println("called : ", err)
		utils.WriteError(w, http.StatusInternalServerError, "Error unfollowing user")
		return
	}

	utils.WriteSuccess(w, "Unfollowed successfully")
}

func (h *FollowHandler) GetFollowersHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/users-followers/", "")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	followers, err := h.Service.GetFollowers(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "DB error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, followers)
}

func (h *FollowHandler) GetFollowingHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/users-following/", "")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	following, err := h.Service.GetFollowing(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "DB error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, following)
}

func (h *FollowHandler) GetRecipientsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	recipients, err := h.Service.GetAcceptedFollowers(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch recipients")
		return
	}

	utils.WriteJSON(w, http.StatusOK, recipients)
}