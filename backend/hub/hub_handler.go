package hub

import (
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
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	userID, _ := h.session.GetUserIDFromSession(w, r) // 🔐 Your own logic
	if userID == 0 {

		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseUnsupportedData, "Authentication required"))
		conn.Close()
		return
	}

	client := &Client{
		ID:   userID,
		Conn: conn,
		Send: make(chan []byte),
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
