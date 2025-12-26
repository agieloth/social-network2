package group

import (
	"net/http"
	"strconv"
	"strings"
)

// GroupRouterHandler est le routeur principal qui délègue aux sub-handlers
func (h *Handler) GroupRouterHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	method := r.Method

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

	// Handle posts/{postID}/comments routes first
	if len(pathParts) >= 5 && pathParts[3] == "posts" {
		postIDStr := pathParts[4]
		if _, err := strconv.Atoi(postIDStr); err == nil {
			if len(pathParts) == 6 && pathParts[5] == "comments" {
				h.Posts.HandlePostComments(w, r, method)
				return
			}
		}
	}

	// Route to appropriate sub-handler based on suffix
	switch {
	// Membership routes
	case suffix == "members" && method == http.MethodGet:
		h.Membership.GetMembers(w, r)
	case suffix == "membership" && method == http.MethodGet:
		h.Membership.CheckAccess(w, r)
	case suffix == "membership/pending_requests" && method == http.MethodGet:
		h.Membership.GetPendingRequests(w, r)
	case suffix == "membership/join":
		h.Membership.JoinRequest(w, r)
	case suffix == "membership/accept" && method == http.MethodPost:
		h.Membership.AcceptInvite(w, r)
	case suffix == "membership/refuse" && method == http.MethodPost:
		h.Membership.RefuseInvite(w, r)
	case suffix == "invite" && method == http.MethodPost:
		h.Membership.InviteUser(w, r)
	case suffix == "membership/approve" && method == http.MethodPost:
		h.Membership.ApproveRequest(w, r)
	case suffix == "membership/decline" && method == http.MethodPost:
		h.Membership.DeclineRequest(w, r)
	case suffix == "invitable_members":
		h.Membership.GetInvitableMembers(w, r)

	// Posts routes
	case suffix == "posts" && method == http.MethodGet:
		h.Posts.GetPosts(w, r)
	case suffix == "posts" && method == http.MethodPost:
		h.Posts.CreatePost(w, r)
	case suffix == "comments" && method == http.MethodGet:
		h.Posts.GetComments(w, r)
	case suffix == "comments" && method == http.MethodPost:
		h.Posts.CreateComment(w, r)

	// Events routes
	case suffix == "events" && method == http.MethodGet:
		h.Events.GetEvents(w, r)
	case suffix == "events" && method == http.MethodPost:
		h.Events.CreateEvent(w, r)
	case strings.HasSuffix(suffix, "/vote") && method == http.MethodPost:
		h.Events.Vote(w, r)

	// Chat routes
	case suffix == "chat" && method == http.MethodGet:
		h.Chat.GetHistory(w, r)
	case suffix == "messages" && method == http.MethodPost:
		h.Chat.SendMessage(w, r)

	default:
		http.NotFound(w, r)
	}
}