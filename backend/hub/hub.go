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
			fmt.Println("✅ Registered user", client.ID)

		case client := <-h.Unregister:
			delete(h.Clients, client.ID)
			close(client.Send)

		case msg := <-h.Broadcast:
			msgBytes, err := json.Marshal(msg)
			if err != nil {
				fmt.Println("❌ Failed to marshal message:", err)
				continue
			}

			switch msg.Type {
			case "private":
				// Process private message
				if err := h.messageService.ProcessPrivateMessage(msg); err != nil {
					fmt.Println("Error processing private message:", err)
					continue
				}

				// Send to recipient if connected
				if recipient, ok := h.Clients[msg.To]; ok {
					select {
					case recipient.Send <- msgBytes:
						fmt.Printf("✅ Private message sent to user %d\n", msg.To)
					default:
						close(recipient.Send)
						delete(h.Clients, recipient.ID)
					}
				}

			case "group":
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

				// Broadcast to all connected group members except sender
				for _, memberID := range members {
					if memberID == msg.From {
						continue // Skip sender
					}

					if client, ok := h.Clients[memberID]; ok {
						msg.To = memberID
						msgBytes, err := json.Marshal(msg)
						if err != nil {
							fmt.Println("❌ Failed to marshal message:", err)
							continue
						}
						select {
						case client.Send <- msgBytes:
							fmt.Println("nothing", string(msgBytes))
							// Message sent successfully
						default:
							// Handle full channel or disconnected client
							close(client.Send)
							delete(h.Clients, client.ID)
						}
					}
				}
				fmt.Printf("✅ Group message broadcast to %d members of group %d\n", len(members)-1, msg.GroupID)

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
		recipient.Send <- msgBytes
	}
}

func (h *Hub) SendMessageToUser(userID int, message models.Message) {
	msgBytes, err := json.Marshal(message)
	if err != nil {
		fmt.Printf("❌ Failed to marshal message: %v\n", err)
		return
	}

	if client, ok := h.Clients[userID]; ok {
		select {
		case client.Send <- msgBytes:
			fmt.Printf("✅ Message sent to user %d\n", userID)
		default:
			// Canal plein, client déconnecté ou occupé
			fmt.Printf("⚠️ Failed to send message to user %d (channel full or client disconnected)\n", userID)
		}
	} else {
		fmt.Printf("⚠️ User %d not connected\n", userID)
	}
}

func (h *Hub) WarmGroupMembersCache(groupID int) error {
	members, err := h.services.GetGroupMembers(groupID)
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
