package handlers

import (
	"net/http"

	"social/services"
	"social/utils"
)

type ChatHandler struct {
	Service *services.ChatService
	Session *services.SessionService
}

func NewChatHandler(chatService *services.ChatService, sessionService *services.SessionService) *ChatHandler {
	return &ChatHandler{
		Service: chatService,
		Session: sessionService,
	}
}

func (h *ChatHandler) GetAllChatUsers(w http.ResponseWriter, r *http.Request) {
	requesterID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	users, err := h.Service.GetAllChatUsers(requesterID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	utils.WriteJSON(w, http.StatusOK, users)
}

func (h *ChatHandler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	otherID, err := utils.ExtractQueryInt(r, "with")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Missing or invalid 'with' parameter")
		return
	}

	messages, err := h.Service.GetChatHistory(userID, otherID)
	if err != nil {
		if err.Error() == "chat not allowed: users must follow each other" {
			utils.WriteError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.WriteJSON(w, http.StatusOK, messages)
}