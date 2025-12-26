package group

import (
	"encoding/json"
	"errors"
	"net/http"

	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
)

var (
	ErrUnauthorized = errors.New("user not authorized")
	ErrInvalidDate  = errors.New("invalid date format")
	ErrEmptyMessage = errors.New("message content cannot be empty")
)

type Handler struct {
	Service *services.GroupService
	Session *services.SessionService
	Hub     *hub.Hub

	// Sub-handlers
	Membership *MembershipHandler
	Posts      *PostsHandler
	Events     *EventsHandler
	Chat       *ChatHandler
}

func NewHandler(service *services.GroupService, session *services.SessionService, hub *hub.Hub) *Handler {
	h := &Handler{
		Service: service,
		Session: session,
		Hub:     hub,
	}

	// Initialize sub-handlers
	h.Membership = NewMembershipHandler(service, session, hub)
	h.Posts = NewPostsHandler(service, session)
	h.Events = NewEventsHandler(service, session, hub)
	h.Chat = NewChatHandler(service, session, hub)

	return h
}

// GetGroupByIDHandler récupère un groupe par son ID
func (h *Handler) GetGroupByIDHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	group, err := h.Service.GetGroupDetailsByID(groupID, userID)
	if err != nil {
		if err.Error() == "Group not found" {
			utils.WriteError(w, http.StatusNotFound, "Group not found")
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch group details")
		return
	}

	utils.WriteJSON(w, http.StatusOK, group)
}

// GetGroups retourne la liste de tous les groupes pour l'utilisateur
func (h *Handler) GetGroups(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	groups, err := h.Service.GetGroupsForUser(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch groups")
		return
	}

	utils.WriteJSON(w, http.StatusOK, groups)
}

// CreateGroup crée un nouveau groupe
func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	group, err := h.Service.CreateGroup(userID, req)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create group")
		return
	}

	utils.WriteJSON(w, http.StatusCreated, group)
}

// DynamicMethods gère GET (liste) et POST (création) sur /api/groups
func (h *Handler) DynamicMethods(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetGroups(w, r)
	case http.MethodPost:
		h.CreateGroup(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}