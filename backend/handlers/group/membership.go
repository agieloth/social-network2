package group

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
)

type MembershipHandler struct {
	Service *services.GroupService
	Session *services.SessionService
	Hub     *hub.Hub
}

func NewMembershipHandler(service *services.GroupService, session *services.SessionService, hub *hub.Hub) *MembershipHandler {
	return &MembershipHandler{
		Service: service,
		Session: session,
		Hub:     hub,
	}
}

// GetMembers récupère la liste des membres d'un groupe
func (h *MembershipHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/members")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	members, err := h.Service.GetGroupMembers(groupID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			utils.WriteError(w, http.StatusNotFound, "Group not found")
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get group members")
		return
	}

	utils.WriteJSON(w, http.StatusOK, members)
}

// CheckAccess vérifie l'accès d'un utilisateur à un groupe
func (h *MembershipHandler) CheckAccess(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	access, err := h.Service.CheckUserAccessStatus(groupID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to check access")
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]string{"status": access})
}

// GetPendingRequests récupère les demandes d'adhésion en attente
func (h *MembershipHandler) GetPendingRequests(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership/pending_requests")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	requests, err := h.Service.GetPendingRequests(groupID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get pending requests")
		return
	}

	utils.WriteJSON(w, http.StatusOK, requests)
}

// JoinRequest envoie une demande pour rejoindre un groupe
func (h *MembershipHandler) JoinRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership/join")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := h.Service.JoinGroupRequest(groupID, userID); err != nil {
		if err.Error() == "User is already a member" {
			utils.WriteError(w, http.StatusConflict, err.Error())
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to send join request")
		return
	}

	utils.WriteSuccess(w, "Join request sent successfully")
}

// AcceptInvite accepte une invitation à rejoindre un groupe
func (h *MembershipHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership/accept")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := h.Service.AcceptInvite(groupID, userID); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to accept invite")
		return
	}

	utils.WriteSuccess(w, "Invite accepted successfully")
}

// RefuseInvite refuse une invitation à rejoindre un groupe
func (h *MembershipHandler) RefuseInvite(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership/refuse")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := h.Service.RefuseInvite(groupID, userID); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to refuse invite")
		return
	}

	utils.WriteSuccess(w, "Invite refused successfully")
}

// InviteUser invite un utilisateur à rejoindre le groupe
func (h *MembershipHandler) InviteUser(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/invite")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	senderID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.InviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	notification, err := h.Service.InviteUserToGroup(groupID, senderID, req)
	if err != nil {
		fmt.Println("Error inviting user:", err)
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if h.Hub != nil {
		h.Hub.SendNotification(notification, req.UserID)
	}

	utils.WriteSuccess(w, "User invited successfully")
}

// ApproveRequest approuve une demande d'adhésion
func (h *MembershipHandler) ApproveRequest(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership/approve")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	creatorID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.ApproveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.ApproveMembership(groupID, creatorID, req); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteSuccess(w, "Request approved successfully")
}

// DeclineRequest refuse une demande d'adhésion
func (h *MembershipHandler) DeclineRequest(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/membership/decline")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	creatorID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.DeclineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.DeclineMembership(groupID, creatorID, req); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteSuccess(w, "Request declined successfully")
}

// GetInvitableMembers récupère les utilisateurs qui peuvent être invités
func (h *MembershipHandler) GetInvitableMembers(w http.ResponseWriter, r *http.Request) {
	groupID, err := utils.ExtractIDFromPath(r.URL.Path, "/api/groups/", "/invitable_members")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	userID, ok := utils.GetUserIDFromContext(r.Context())
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	users, err := h.Service.GetNonGroupMembers(groupID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	utils.WriteJSON(w, http.StatusOK, users)
}