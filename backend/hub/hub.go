package hub

import (
	"encoding/json"
	"fmt"
	"sync"

	"social/models"
	"social/services"
)

type Hub struct {
	Clients    map[int]*Client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan models.Message
	services   *Handler
	// Add group members cache
	groupMembersCache map[int][]int // groupID -> []userIDs
	cacheMutex        sync.RWMutex
	messageService    *services.ChatService
}

func NewHub(messageService *services.ChatService) *Hub {
	return &Hub{
		Clients:           make(map[int]*Client),
		Register:          make(chan *Client),
		Unregister:        make(chan *Client),
		Broadcast:         make(chan models.Message),
		groupMembersCache: make(map[int][]int),
		messageService:    messageService,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client.ID] = client
			fmt.Printf("\n✅ === USER REGISTERED === \n")
			fmt.Printf("   User ID: %d\n", client.ID)
			fmt.Printf("   Total connected users: %d\n", len(h.Clients))
			fmt.Printf("   Connected user IDs: %v\n\n", func() []int {
				ids := make([]int, 0)
				for id := range h.Clients {
					ids = append(ids, id)
				}
				return ids
			}())

		case client := <-h.Unregister:
			delete(h.Clients, client.ID)
			close(client.Send)

		case msg := <-h.Broadcast:
			fmt.Printf("📨 Broadcast received - Type: %s, From: %d, To: %d\n", msg.Type, msg.From, msg.To)
			fmt.Printf("🔍 Current connected clients: %v\n", func() []int {
				ids := make([]int, 0)
				for id := range h.Clients {
					ids = append(ids, id)
				}
				return ids
			}())

			msgBytes, err := json.Marshal(msg)
			if err != nil {
				fmt.Println("❌ Failed to marshal message:", err)
				continue
			}

			switch msg.Type {
			case "private":
				// Process private message
				if err := h.messageService.ProcessPrivateMessage(msg); err != nil {
					fmt.Println("❌ Error processing private message:", err)
					continue
				}

				// Send to recipient if connected
				if recipient, ok := h.Clients[msg.To]; ok {
					h.safeSend(recipient, msgBytes)
				} else {
					fmt.Printf("⚠️ Recipient user %d not connected\n", msg.To)
				}

				// IMPORTANT: Also send confirmation back to sender for real-time display
				// This ensures the sender sees the message immediately
				if sender, ok := h.Clients[msg.From]; ok {
					h.safeSend(sender, msgBytes)
				} else {
					fmt.Printf("⚠️ Sender user %d not connected (no confirmation sent)\n", msg.From)
				}

			case "group_message":
				// Process group message
				if err := h.messageService.ProcessGroupMessage(msg); err != nil {
					fmt.Println("Error processing group message:", err)
					continue
				}

				// Get group members from cache or service
				members, err := h.GetGroupMembers(msg.GroupID)
				if err != nil {
					fmt.Printf("❌ Failed to get group members: %v\n", err)
					continue
				}
				fmt.Println("member", members)

				// Broadcast to all connected group members (including sender)
				for _, memberID := range members {
					if client, ok := h.Clients[memberID]; ok {
						msgCopy := msg
						msgCopy.To = memberID
						msgBytesToSend, err := json.Marshal(msgCopy)
						if err != nil {
							fmt.Println("❌ Failed to marshal message for member:", err)
							continue
						}
						h.safeSend(client, msgBytesToSend)
					} else {
						fmt.Printf("⚠️ User %d not connected\n", memberID)
					}
				}
				fmt.Printf("✅ Group message broadcast to %d members of group %d\n", len(members), msg.GroupID)

			default:
				fmt.Printf("❌ Unknown message type: %s\n", msg.Type)
			}
		}
	}
}

// GetGroupMembers returns group members from cache or fetches from service
func (h *Hub) GetGroupMembers(groupID int) ([]int, error) {
	// Check cache first
	h.cacheMutex.RLock()
	members, cached := h.groupMembersCache[groupID]
	h.cacheMutex.RUnlock()

	if cached {
		return members, nil
	}

	// Cache miss - fetch from service
	groupMembers, err := h.messageService.GetGroupMembers(groupID)
	if err != nil {
		return nil, err
	}

	// Extract user IDs
	userIDs := make([]int, len(groupMembers))
	for i, member := range groupMembers {
		userIDs[i] = member.ID
	}
	// Update cache
	h.cacheMutex.Lock()
	h.groupMembersCache[groupID] = userIDs
	h.cacheMutex.Unlock()

	return userIDs, nil
}

// After inserting notification in DB, fetch it and send:
func (h *Hub) SendNotification(notification models.Notification, toID int) {
	msgBytes, _ := json.Marshal(notification)
	fmt.Println("message that will be sent :", string(msgBytes))
	if recipient, ok := h.Clients[toID]; ok {
		h.safeSend(recipient, msgBytes)
	}
}

func (h *Hub) SendMessageToUser(userID int, message models.Message) {
	msgBytes, err := json.Marshal(message)
	if err != nil {
		fmt.Printf("❌ Failed to marshal message: %v\n", err)
		return
	}

	if client, ok := h.Clients[userID]; ok {
		h.safeSend(client, msgBytes)
	} else {
		fmt.Printf("⚠️ User %d not connected\n", userID)
	}
}

// safeSend envoie des bytes sur le channel du client de façon sûre,
// récupère d'un panic si le channel a été fermé simultanément et nettoie l'état.
func (h *Hub) safeSend(client *Client, data []byte) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("❌ Recovered panic sending to client %d: %v\n", client.ID, r)
			// Ensure channel closed and remove client
			select {
			default:
				// best-effort close
				close(client.Send)
			}
			delete(h.Clients, client.ID)
		}
	}()

	select {
	case client.Send <- data:
		fmt.Printf("✅ Message sent to user %d\n", client.ID)
	default:
		fmt.Printf("⚠️ Failed to send to user %d (channel full)\n", client.ID)
		// best-effort cleanup
		close(client.Send)
		delete(h.Clients, client.ID)
	}
}

func (h *Hub) WarmGroupMembersCache(groupID int) error {
	members, err := h.messageService.GetGroupMembers(groupID)
	if err != nil {
		return err
	}

	h.cacheMutex.Lock()
	defer h.cacheMutex.Unlock()

	userIDs := make([]int, len(members))
	for i, member := range members {
		userIDs[i] = member.ID
	}

	h.groupMembersCache[groupID] = userIDs
	return nil
}
