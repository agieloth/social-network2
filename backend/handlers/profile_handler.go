package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
)

type ProfileHandler struct {
	profileService *services.ProfileService
	sessionService *services.SessionService
	Hub            *hub.Hub
}

func NewProfileHandler(service *services.ProfileService, sessionService *services.SessionService, hub *hub.Hub) *ProfileHandler {
	return &ProfileHandler{profileService: service, sessionService: sessionService, Hub: hub}
}

func (h *ProfileHandler) ProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   false,
		})
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.profileService.ProfileRepo.GetByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			utils.WriteError(w, http.StatusNotFound, "User not found")
		} else {
			fmt.Println("Error fetching user:", err)
			utils.WriteError(w, http.StatusInternalServerError, "Internal server error")
		}
		return
	}

	utils.WriteJSON(w, http.StatusOK, user)
}

func (h *ProfileHandler) GetUserByIDHandler(w http.ResponseWriter, r *http.Request) {
	targetID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/users/", "")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	requesterID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.profileService.GetUserProfile(requesterID, targetID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "User not found")
		return
	}

	utils.WriteJSON(w, http.StatusOK, user)
}

func (h *ProfileHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		utils.WriteError(w, http.StatusBadRequest, "Missing search query")
		return
	}

	results, err := h.profileService.SearchUsers(query)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, results)
}

func (h *ProfileHandler) TogglePrivacy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.PrivacyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.profileService.TogglePrivacy(userID, req.IsPrivate); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteSuccess(w, "Privacy updated successfully")
}

func (h *ProfileHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userId, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	response := map[string]interface{}{
		"id": userId,
	}

	utils.WriteJSON(w, http.StatusOK, response)
}