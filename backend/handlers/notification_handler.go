package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"social/models"
	"social/services"
	"social/utils"
)

type NotificationHandler struct {
	NotificationService *services.NotificationService
	SessionService      *services.SessionService
}

func NewNotificationHandler(notificationService *services.NotificationService, sessionService *services.SessionService) *NotificationHandler {
	return &NotificationHandler{
		NotificationService: notificationService,
		SessionService:      sessionService,
	}
}

func (h *NotificationHandler) GetUserNotifications(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	notifications, err := h.NotificationService.GetUserNotifications(userID)
	if err != nil {
		log.Println("Error fetching notifications:", err)
		notifications = []models.Notification{}
	}

	if notifications == nil {
		notifications = []models.Notification{}
	}

	utils.WriteJSON(w, http.StatusOK, notifications)
}

func (h *NotificationHandler) MarkNotificationSeen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.MarkNotificationSeenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.NotificationService.MarkNotificationsAsSeen(userID, req.NotificationID, req.MarkAll); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *NotificationHandler) DeleteNotification(w http.ResponseWriter, r *http.Request) {
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
		NotificationID int `json:"notification_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.NotificationService.DeleteNotification(userID, req.NotificationID); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "DB error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}