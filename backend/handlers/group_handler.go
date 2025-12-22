package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
	// "github.com/go-chi/chi/v5"
)

var (
	ErrUnauthorized = errors.New("user not authorized")
	ErrInvalidDate  = errors.New("invalid date format")
	ErrEmptyMessage = errors.New("message content cannot be empty")
)

type GroupHandler struct {
	Service *services.GroupService
	Session *services.SessionService
	Hub     *hub.Hub
}

func NewGroupHandler(service *services.GroupService, session *services.SessionService, Hub *hub.Hub) *GroupHandler {
	return &GroupHandler{Service: service, Session: session, Hub: Hub}
}

func (h *GroupHandler) GroupRouterHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	method := r.Method

	// Trim prefix and split into parts
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	if len(pathParts) < 3 {
		http.NotFound(w, r)
		return
	}

	groupIDStr := pathParts[2]

	// Handle /api/groups/{id} direct GET
	if len(pathParts) == 3 {
		if _, err := strconv.Atoi(groupIDStr); err == nil && method == http.MethodGet {
			h.GetGroupByIDHandler(w, r)
			return
		}
	}

	// Build suffix for routing
	suffix := strings.Join(pathParts[3:], "/")

	if suffix == "members" && method == http.MethodGet {
		h.GetGroupMembersHandler(w, r)
		return
	}

	// Handle posts/{postID}/comments routes first
	if len(pathParts) >= 5 && pathParts[3] == "posts" {
		postIDStr := pathParts[4]
		if _, err := strconv.Atoi(postIDStr); err == nil {
			if len(pathParts) == 6 && pathParts[5] == "comments" {
				switch method {
				case http.MethodGet:
					h.GetGroupPostCommentsHandler(w, r)
					return
				case http.MethodPost:
					h.CreateGroupPostCommentHandler(w, r)
					return
				}
			}
		}
	}

	// Handle other routes
	switch {
	case suffix == "membership" && method == http.MethodGet:
		h.CheckGroupAccessHandler(w, r)

	case suffix == "membership/pending_requests" && method == http.MethodGet:
		h.GetPendingRequestsHandler(w, r)

	case suffix == "membership/join":
		h.JoinGroupRequestHandler(w, r)

	case suffix == "membership/accept" && method == http.MethodPost:
		h.AcceptGroupInviteHandler(w, r)
	case suffix == "membership/refuse" && method == http.MethodPost:
		h.RefuseGroupInviteHandler(w, r)

	case suffix == "invite" && method == http.MethodPost:
		h.InviteToGroupHandler(w, r)
	case suffix == "membership/approve" && method == http.MethodPost:
		h.ApproveRequestHandler(w, r)

	case suffix == "membership/decline" && method == http.MethodPost:
		h.DeclineRequestHandler(w, r)

	case suffix == "invitable_members":
		h.GetNonGroupMembersHandler(w, r)

	case suffix == "chat" && method == http.MethodGet:
		h.GetGroupChat(w, r)
	// GROUP POSTS
	case suffix == "posts" && method == http.MethodGet:
		h.GetGroupPostsHandler(w, r)

	case suffix == "posts" && method == http.MethodPost:
		h.CreateGroupPostHandler(w, r)
		// COMMENTS
	case suffix == "comments" && method == http.MethodGet:
		h.GetGroupPostCommentsHandler(w, r)

	case suffix == "comments" && method == http.MethodPost:
		h.CreateGroupPostCommentHandler(w, r)

		// EVENTS
	case suffix == "events" && method == http.MethodGet:
		h.GetGroupEventsHandler(w, r)

	case suffix == "events" && method == http.MethodPost:

		h.CreateGroupEventHandler(w, r)
		fmt.Println("fhfhfh")

	case strings.HasSuffix(suffix, "/vote") && method == http.MethodPost:
		h.HandleEventVote(w, r)

		// CHAT MESSAGES
	case suffix == "messages" && method == http.MethodPost:
		h.HandleGroupMessage(w, r)

	default:
		http.NotFound(w, r)
	}
}

func (h *GroupHandler) GetGroupMembersHandler(w http.ResponseWriter, r *http.Request) {
	// Extraire le groupID de l'URL
	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/members")

	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Appeler le service
	members, err := h.Service.GetGroupMembers(groupID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, "Group not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to get group members", http.StatusInternalServerError)
		return
	}

	// Retourner la réponse JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(members); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

func (h *GroupHandler) GetGroupChat(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get group ID from URL
	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/chat")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Get limit from query params (default to 50)
	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	// Get chat history
	messages, err := h.Service.GetGroupChatHistory(groupID, limit)
	if err != nil {
		http.Error(w, "Failed to get chat history", http.StatusInternalServerError)
		return
	}

	// Return messages
	w.Header().Set("Content-Type", "application/json")
	if messages == nil {
		messages = []models.GroupMessage{}
	}
	json.NewEncoder(w).Encode(messages)
}

func (h *GroupHandler) GetGroupByIDHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	groupID, err := strconv.Atoi(pathParts[len(pathParts)-1])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupResp, err := h.Service.GetGroupDetailsByID(groupID, userID)
	if err != nil {
		fmt.Println("error is : ", err)
		if err.Error() == "Group not found" {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to fetch group details", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groupResp)
}

func (h *GroupHandler) CheckGroupAccessHandler(w http.ResponseWriter, r *http.Request) {
	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/membership")

	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	status, err := h.Service.CheckUserAccessStatus(groupID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Group not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	resp := map[string]string{"status": status}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *GroupHandler) GetPendingRequestsHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	groupID, err := strconv.Atoi(pathParts[3])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	requests, err := h.Service.GetPendingRequests(groupID, userID)
	if err != nil {
		if err.Error() == "only group creator can view pending requests" {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		if err == sql.ErrNoRows {
			http.Error(w, "Group not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

func (h *GroupHandler) JoinGroupRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/membership/join")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	err = h.Service.JoinGroupRequest(groupID, userID)
	if err != nil {
		if err.Error() == "request already exists or already a member" {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		http.Error(w, "Failed to create join request", http.StatusInternalServerError)
		return
	}
	groupCreatorId, _ := h.Service.Repo.GetGroupCreatorID(groupID)
	nickname := h.Session.GetUserNicknameById(userID)
	// Create and send notification to group owner
	notification := models.Notification{
		SenderID:       userID,
		SenderNickname: nickname,
		Type:           "group_join_request",
		Message:        fmt.Sprintf("%s wants to join your group", nickname),
		Seen:           false,
		CreatedAt:      time.Now().Format(time.RFC3339),
		GroupId:        groupID,
	}
	_, err = h.Service.Repo.CreateNotification(groupCreatorId, notification)
	if err != nil {
		fmt.Println(err)
		return
	}

	h.Hub.SendNotification(notification, groupCreatorId)

	w.WriteHeader(http.StatusCreated)
}

func (h *GroupHandler) AcceptGroupInviteHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/membership/accept")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	err = h.Service.AcceptInvite(groupID, userID)
	if err != nil {
		switch err.Error() {
		case "membership not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		case "user is not invited":
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *GroupHandler) RefuseGroupInviteHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/membership/refuse")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	err = h.Service.RefuseInvite(groupID, userID)
	if err != nil {
		switch err.Error() {
		case "membership not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		case "user is not invited":
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *GroupHandler) InviteToGroupHandler(w http.ResponseWriter, r *http.Request) {
	creatorID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || creatorID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/invite")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	var invite models.InviteRequest
	err = json.NewDecoder(r.Body).Decode(&invite)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	notif, err := h.Service.InviteUserToGroup(groupID, creatorID, invite)
	if err != nil {
		switch err.Error() {
		case "group not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		case "not authorized":
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "Failed to invite user", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusCreated)
	h.Hub.SendNotification(notif, invite.UserID)
}

func (h *GroupHandler) ApproveRequestHandler(w http.ResponseWriter, r *http.Request) {
	creatorID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || creatorID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/membership/approve")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	var body models.ApproveRequest
	err = json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	err = h.Service.ApproveMembership(groupID, creatorID, body)
	if err != nil {
		switch err.Error() {
		case "group not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		case "forbidden":
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "Failed to approve request", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *GroupHandler) DeclineRequestHandler(w http.ResponseWriter, r *http.Request) {
	creatorID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || creatorID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/membership/decline")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	var body models.DeclineRequest
	err = json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.Service.DeclineMembership(groupID, creatorID, body)
	if err != nil {
		switch err.Error() {
		case "group not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		case "forbidden":
			http.Error(w, err.Error(), http.StatusForbidden)
		default:
			http.Error(w, "Failed to decline request", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *GroupHandler) GetNonGroupMembersHandler(w http.ResponseWriter, r *http.Request) {
	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/invitable_members")

	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	users, err := h.Service.GetNonGroupMembers(groupID, userID)
	if err != nil {
		http.Error(w, "Failed to get non-members", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *GroupHandler) GetGroupPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		log.Println("🔒 Unauthorized user")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/posts")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		log.Println("❌ Invalid group ID:", groupIDStr)
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	log.Printf("📥 Fetching posts for group %d (user %d)", groupID, userID)

	posts, err := h.Service.GetGroupPosts(groupID, userID)
	if err != nil {
		log.Println("🔥 Error fetching posts:", err)
		http.Error(w, "Failed to fetch posts", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ %d posts found", len(posts))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func (h *GroupHandler) CreateGroupPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "Error parsing form", http.StatusBadRequest)
		return
	}

	groupIDStr := r.FormValue("group_id")
	content := r.FormValue("content")

	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	isMember, err := h.Service.IsGroupMember(groupID, userID)
	if err != nil || !isMember {
		http.Error(w, "Not authorized", http.StatusForbidden)
		return
	}

	var imagePath string
	file, header, err := r.FormFile("image")
	if err == nil {
		defer file.Close()

		imagePath = "uploads/group_posts/" + header.Filename
		out, err := os.Create(imagePath)
		if err != nil {
			http.Error(w, "Unable to save file", http.StatusInternalServerError)
			return
		}
		defer out.Close()

		_, err = io.Copy(out, file)
		if err != nil {
			http.Error(w, "Failed to write file", http.StatusInternalServerError)
			return
		}
		imagePath = "http://localhost:8080/uploads/group_posts/" + header.Filename
	}
	fmt.Println("pth", imagePath)
	post := models.GroupPost{
		GroupID:  groupID,
		AuthorID: userID,
		Content:  content,
		Image:    imagePath,
	}

	createdPost, err := h.Service.CreateGroupPost(post)
	if err != nil {
		http.Error(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(createdPost)
}

func (h *GroupHandler) GetGroupPostCommentsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// URL: /api/groups/{groupID}/posts/{postID}/comments
	urlParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(urlParts) < 6 {
		http.Error(w, "Invalid URL format", http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(urlParts[4])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	comments, err := h.Service.GetGroupPostComments(postID, userID)
	if err != nil {
		log.Printf("Error fetching comments: %v", err)
		http.Error(w, "Failed to fetch comments", http.StatusInternalServerError)
		return
	}

	if comments == nil {
		comments = []models.GroupPostComment{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

func (h *GroupHandler) CreateGroupPostCommentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	urlParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(urlParts) < 6 {
		http.Error(w, "Invalid URL format", http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(urlParts[4])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	comment, err := h.Service.CreateGroupPostComment(userID, postID, req.Content)
	if err != nil {
		log.Printf("Error creating comment: %v", err)
		http.Error(w, "Failed to create comment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comment)
}

func (h *GroupHandler) GetGroupEventsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract groupID from URL
	groupIDStr := strings.TrimPrefix(r.URL.Path, "/api/groups/")
	groupIDStr = strings.TrimSuffix(groupIDStr, "/events")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	events, err := h.Service.GetGroupEvents(userID, groupID)
	if err != nil {
		http.Error(w, "Failed to fetch events", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (h *GroupHandler) CreateGroupEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	event, err := h.Service.CreateGroupEvent(userID, req)
	if err != nil {
		switch err {
		case ErrUnauthorized:
			http.Error(w, "Not authorized", http.StatusForbidden)
		case ErrInvalidDate:
			http.Error(w, "Invalid date format", http.StatusBadRequest)
		default:
			http.Error(w, "Failed to create event", http.StatusInternalServerError)
		}
		return
	}

	go h.broadcastEventNotification(event, userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}

func (h *GroupHandler) broadcastEventNotification(event models.GroupEvent, creatorID int) {
	// Get group members
	members, err := h.Service.GetGroupMembers(event.GroupID)
	if err != nil {
		log.Printf("Failed to get group members for notification: %v", err)
		return
	}

	// Create notification
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
	// Create and send notifications to all members except creator
	for _, member := range members {
		if member.ID == creatorID {
			continue
		}

		// Store notification in DB
		notifID, err := h.Service.Repo.CreateNotification(member.ID, notification)
		if err != nil {
			log.Printf("Failed to create notification for user %d: %v", member.ID, err)
			continue
		}

		// Send real-time notification
		notification.ID = notifID
		h.Hub.SendNotification(notification, member.ID)
	}
}

func (h *GroupHandler) HandleGroupMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract group ID from path: /api/groups/{id}/messages
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	groupID, err := strconv.Atoi(parts[len(parts)-2])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	msg, err := h.Service.SendGroupMessage(userID, groupID, req.Content)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			http.Error(w, "Not a member of the group", http.StatusForbidden)
		} else {
			http.Error(w, "Failed to send message", http.StatusInternalServerError)
		}
		return
	}

	// Broadcast via WebSocket
	h.Hub.Broadcast <- msg

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Group message sent successfully",
	})
}

func (h *GroupHandler) GetGroups(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	groups, err := h.Service.GetGroupsForUser(userID)
	if err != nil {
		http.Error(w, "Failed to fetch groups", http.StatusInternalServerError)
		return
	}

	utils.WriteJSON(w, http.StatusOK, groups)
}

func (h *GroupHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	group, err := h.Service.CreateGroup(userID, req)
	if err != nil {
		http.Error(w, "Failed to create group", http.StatusInternalServerError)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, group)
}

func (h *GroupHandler) DynamicMethods(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.GetGroups(w, r)
	} else if r.Method == http.MethodPost {
		h.CreateGroup(w, r)
	}
}

// Add this to your handler methods
func (h *GroupHandler) HandleEventVote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.Session.GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract event ID from URL: /api/groups/{groupID}/events/{eventID}/vote
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 6 {
		fmt.Println("error")
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	eventID, err := strconv.Atoi(parts[len(parts)-2])
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Invalid event ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Println(err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.Service.SetEventResponse(userID, eventID, req.Response)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrUnauthorized):
			http.Error(w, "Not authorized", http.StatusForbidden)
		case strings.Contains(err.Error(), "invalid response type"):
			http.Error(w, err.Error(), http.StatusBadRequest)
		default:
			http.Error(w, "Failed to process vote", http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Vote recorded successfully",
	})
}

// func (h *GroupHandler) GetGroupMembers(w http.ResponseWriter, r *http.Request) {
// 	// Extract group ID from URL params or query string
// 	groupIDStr := chi.URLParam(r, "groupID")
// 	groupID, err := strconv.Atoi(groupIDStr)
// 	if err != nil {
// 		http.Error(w, "Invalid group ID", http.StatusBadRequest)
// 		return
// 	}

// 	// Call service layer
// 	members, err := h.Service.GetGroupMembers(groupID)
// 	if err != nil {
// 		// Handle different error types appropriately
// 		if strings.Contains(err.Error(), "not found") {
// 			http.Error(w, "Group not found", http.StatusNotFound)
// 			return
// 		}
// 		http.Error(w, "Failed to get group members", http.StatusInternalServerError)
// 		return
// 	}

// 	// Return JSON response
// 	w.Header().Set("Content-Type", "application/json")
// 	if err := json.NewEncoder(w).Encode(members); err != nil {
// 		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
// 	}
// }
