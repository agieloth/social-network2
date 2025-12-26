package group

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
)

type ChatHandler struct {
	Service *services.GroupService
	Session *services.SessionService
	Hub     *hub.Hub
}

func NewChatHandler(service *services.GroupService, session *services.SessionService, hub *hub.Hub) *ChatHandler {
	return &ChatHandler{
		Service: service,
		Session: session,
		Hub:     hub,
	}
}

// GetHistory récupère l'historique des messages d'un groupe
func (h *ChatHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/chat")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	limit := utils.ExtractQueryIntWithDefault(r, "limit", 50)

	messages, err := h.Service.GetGroupChatHistory(groupID, limit)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get chat history")
		return
	}

	if messages == nil {
		messages = []models.GroupMessage{}
	}

	utils.WriteJSON(w, http.StatusOK, messages)
}

// SendMessage envoie un message dans le chat du groupe
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Extract group ID from path: /api/groups/{id}/messages
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		utils.WriteError(w, http.StatusBadRequest, "Invalid path")
		return
	}

	groupID, err := strconv.Atoi(parts[len(parts)-2])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Content == "" {
		utils.WriteError(w, http.StatusBadRequest, "Message content cannot be empty")
		return
	}

	msg, err := h.Service.SendGroupMessage(userID, groupID, req.Content)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			utils.WriteError(w, http.StatusForbidden, "Not a member of the group")
		} else {
			utils.WriteError(w, http.StatusInternalServerError, "Failed to send message")
		}
		return
	}

	// Broadcast via WebSocket
	if h.Hub != nil {
		h.Hub.Broadcast <- msg
	}

	utils.WriteSuccess(w, "Group message sent successfully")
}