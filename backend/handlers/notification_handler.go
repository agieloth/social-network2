package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"social/models"
	"social/services"
)

type NotificationHandler struct {
	NotificationService *services.NotificationService
	SessionService      *services.SessionService // auth.GetUserIDFromSession equivalent
}

func NewNotificationHandler(notificationService *services.NotificationService, sessionService *services.SessionService) *NotificationHandler {
	return &NotificationHandler{
		NotificationService: notificationService,
		SessionService:      sessionService,
	}
}

func (h *NotificationHandler) GetUserNotifications(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.SessionService.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	notifications, err := h.NotificationService.GetUserNotifications(userID)
	if err != nil {
		log.Println("Error fetching notifications:", err)
		notifications = []models.Notification{} // fallback to empty array
	}

	if notifications == nil {
		notifications = []models.Notification{}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(notifications); err != nil {
		log.Println("Error encoding notifications:", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

func (h *NotificationHandler) MarkNotificationSeen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := h.SessionService.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.MarkNotificationSeenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := h.NotificationService.MarkNotificationsAsSeen(userID, req.NotificationID, req.MarkAll); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// handler/notification_handler.go
func (h *NotificationHandler) DeleteNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := h.SessionService.GetUserIDFromSession(w, r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		NotificationID int `json:"notification_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err := h.NotificationService.DeleteNotification(userID, req.NotificationID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
