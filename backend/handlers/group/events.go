package group

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
)

type EventsHandler struct {
	Service *services.GroupService
	Session *services.SessionService
	Hub     *hub.Hub
}

func NewEventsHandler(service *services.GroupService, session *services.SessionService, hub *hub.Hub) *EventsHandler {
	return &EventsHandler{
		Service: service,
		Session: session,
		Hub:     hub,
	}
}

// GetEvents récupère les événements d'un groupe
func (h *EventsHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/events")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	events, err := h.Service.GetGroupEvents(userID, groupID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch events")
		return
	}

	utils.WriteJSON(w, http.StatusOK, events)
}

// CreateEvent crée un nouvel événement dans le groupe
func (h *EventsHandler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	event, err := h.Service.CreateGroupEvent(userID, req)
	if err != nil {
		switch err {
		case ErrUnauthorized:
			utils.WriteError(w, http.StatusForbidden, "Not authorized")
		case ErrInvalidDate:
			utils.WriteError(w, http.StatusBadRequest, "Invalid date format")
		default:
			utils.WriteError(w, http.StatusInternalServerError, "Failed to create event")
		}
		return
	}

	// Envoyer des notifications aux membres du groupe
	go h.broadcastEventNotification(event, userID)

	utils.WriteJSON(w, http.StatusCreated, event)
}

// broadcastEventNotification envoie une notification à tous les membres du groupe
func (h *EventsHandler) broadcastEventNotification(event models.GroupEvent, creatorID int) {
	members, err := h.Service.GetGroupMembers(event.GroupID)
	if err != nil {
		log.Printf("Failed to get group members for notification: %v", err)
		return
	}

	notification := models.Notification{
		SenderID:       creatorID,
		SenderNickname: event.CreatorName,
		GroupId:        event.GroupID,
		EventId:        event.ID,
		Type:           "group_event_created",
		Message:        fmt.Sprintf("%s created a new event: %s", event.CreatorName, event.Title),
		Seen:           false,
		CreatedAt:      time.Now().Format(time.RFC3339),
	}

	for _, member := range members {
		if member.ID == creatorID {
			continue
		}

		notifID, err := h.Service.Repo.CreateNotification(member.ID, notification)
		if err != nil {
			log.Printf("Failed to create notification for user %d: %v", member.ID, err)
			continue
		}

		notification.ID = notifID
		h.Hub.SendNotification(notification, member.ID)
	}
}

// Vote enregistre le vote d'un utilisateur pour un événement
func (h *EventsHandler) Vote(w http.ResponseWriter, r *http.Request) {
	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Extraire l'event ID depuis l'URL: /api/groups/{groupID}/events/{eventID}/vote
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 6 {
		utils.WriteError(w, http.StatusBadRequest, "Invalid URL format")
		return
	}

	eventID, err := strconv.Atoi(pathParts[4])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid event ID")
		return
	}

	var req struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Response != "going" && req.Response != "not_going" {
		utils.WriteError(w, http.StatusBadRequest, "Response must be 'going' or 'not_going'")
		return
	}

	if err := h.Service.SetEventResponse(userID, eventID, req.Response); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to register vote")
		return
	}

	utils.WriteSuccess(w, "Vote registered successfully")
}