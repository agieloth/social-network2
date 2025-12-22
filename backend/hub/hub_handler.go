package hub

import (
	"fmt"
	"log"
	"net/http"

	"social/models"
	"social/services"

	"github.com/gorilla/websocket"
)

type Handler struct {
	service *services.AuthService
	session *services.SessionService
	group   *services.GroupService
	serv    *services.ChatService
	hub     *Hub
}

func NewHandler(service *services.AuthService, session *services.SessionService, group *services.GroupService, hubS *Hub) *Handler {
	return &Handler{service: service, session: session, group: group, hub: hubS}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // allow all origins for now
	},
}

func (h *Handler) ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	log.Printf("🌐 WebSocket request received from %s - Headers: %v\n", r.RemoteAddr, r.Header.Get("Origin"))

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Upgrade error: %v\n", err)
		http.Error(w, "Failed to upgrade connection", http.StatusBadRequest)
		return
	}

	log.Println("✅ WebSocket connection upgraded successfully")

	// Try to get userID from session cookie first
	userID, err := h.session.GetUserIDFromSession(r)

	// If session not found or error, try to get from query parameter
	if err != nil || userID == 0 {
		userIDStr := r.URL.Query().Get("userId")
		if userIDStr == "" {
			log.Println("❌ Authentication required: No session and no userId parameter")
			conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "Authentication required"))
			conn.Close()
			return
		}

		// Parse userID from query parameter
		var parsedID int
		_, err := fmt.Sscanf(userIDStr, "%d", &parsedID)
		if err != nil || parsedID <= 0 {
			log.Printf("❌ Invalid userId parameter: %s\n", userIDStr)
			conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "Invalid userId"))
			conn.Close()
			return
		}
		userID = parsedID
		log.Printf("✅ Authentication via query parameter - userID: %d\n", userID)
	} else {
		log.Printf("✅ Authentication via session cookie - userID: %d\n", userID)
	}

	client := &Client{
		ID:   userID,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	hub.Register <- client

	go h.notifyGroupMembersOfOnlineStatus(userID, hub)

	go client.writePump()
	go client.readPump(hub)
}

func (h *Handler) notifyGroupMembersOfOnlineStatus(userID int, hub *Hub) {
	groups, err := h.group.GetGroupsForUser(userID)
	if err != nil {
		log.Printf("Error getting groups for user %d: %v", userID, err)
		return
	}

	for _, group := range groups {
		members, err := h.group.GetGroupMembers(group.ID)
		if err != nil {
			log.Printf("Error getting members for group %d: %v", group.ID, err)
			continue
		}

		onlineStatusMsg := models.Message{
			Type:    "user_online",
			From:    userID,
			GroupID: group.ID,
		}

		for _, member := range members {
			if member.ID != userID {
				hub.SendMessageToUser(member.ID, onlineStatusMsg)
			}
		}
	}
}

func (h *Handler) GetGroupMembers(id int) ([]models.GroupMember, error) {
	return h.group.GetGroupMembers(id)
}
