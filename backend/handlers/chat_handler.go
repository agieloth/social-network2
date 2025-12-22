package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"social/services"
)

type ChatHandler struct {
	Service *services.ChatService
	Session *services.SessionService // For getting user ID from session
}

// NewChatHandler creates a new ChatHandler instance
func NewChatHandler(chatService *services.ChatService, sessionService *services.SessionService) *ChatHandler {
	return &ChatHandler{
		Service: chatService,
		Session: sessionService,
	}
}

func (h *ChatHandler) GetAllChatUsers(w http.ResponseWriter, r *http.Request) {
	requesterID, err := h.Session.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	users, err := h.Service.GetAllChatUsers(requesterID)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(users)
}

func (h *ChatHandler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	otherIDStr := r.URL.Query().Get("with")
	if otherIDStr == "" {
		http.Error(w, "Missing 'with' parameter", http.StatusBadRequest)
		return
	}

	otherID, err := strconv.Atoi(otherIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	messages, err := h.Service.GetChatHistory(userID, otherID)
	if err != nil {
		if err.Error() == "chat not allowed: users must follow each other" {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(messages)
}
