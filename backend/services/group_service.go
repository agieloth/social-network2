package services

import (
	"database/sql"
	"errors"
	"fmt"
	"social/models"
	"social/repositories"
	"time"
)

var (
	ErrUnauthorized = errors.New("user not authorized")
	ErrInvalidDate  = errors.New("invalid date format")
	ErrEmptyMessage = errors.New("message content cannot be empty")
)

type GroupService struct {
	Repo *repositories.GroupRepository
}
type HubInterface interface {
	InvalidateGroupMembersCache(groupID int)
}

func NewGroupService(Repo *repositories.GroupRepository) *GroupService {
	return &GroupService{Repo: Repo}
}

func (s *GroupService) GetGroupDetailsByID(groupID, userID int) (*models.GroupResponse, error) {
	return s.Repo.GetGroupDetailsByID(groupID, userID)
}

func (s *GroupService) CheckUserAccessStatus(groupID, userID int) (string, error) {
	creatorID, err := s.Repo.GetGroupCreatorID(groupID)
	if err != nil {
		return "", err
	}

	if userID == creatorID {
		return "creator", nil
	}

	status, err := s.Repo.GetMembershipStatus(groupID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "none", nil
		}
		return "", err
	}

	return status, nil
}

func (s *GroupService) GetPendingRequests(groupID, userID int) ([]models.PendingRequest, error) {
	creatorID, err := s.Repo.GetGroupCreatorID(groupID)
	if err != nil {
		return nil, err
	}

	if creatorID != userID {
		return nil, fmt.Errorf("only group creator can view pending requests")
	}

	requests, err := s.Repo.GetPendingRequests(groupID)
	if err != nil {
		return nil, err
	}

	return requests, nil
}

func (s *GroupService) JoinGroupRequest(groupID, userID int) error {
	exists, err := s.Repo.CheckMembershipExists(groupID, userID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("request already exists or already a member")
	}

	err = s.Repo.CreateJoinRequest(groupID, userID)
	if err != nil {
		return err
	}
	return nil
}

func (s *GroupService) AcceptInvite(groupID, userID int) error {
	status, err := s.Repo.GetMembershipStatus(groupID, userID)
	if err != nil {
		return fmt.Errorf("membership not found")
	}

	if status != "invited" {
		return fmt.Errorf("user is not invited")
	}

	err = s.Repo.UpdateMembershipStatus(groupID, userID, "accepted")
	if err != nil {
		return err
	}

	return nil
}

func (s *GroupService) RefuseInvite(groupID, userID int) error {
	status, err := s.Repo.GetMembershipStatus(groupID, userID)
	if err != nil {
		return fmt.Errorf("membership not found")
	}

	if status != "invited" {
		return fmt.Errorf("user is not invited")
	}

	err = s.Repo.DeleteMembership(groupID, userID)
	if err != nil {
		return err
	}

	return nil
}


func (s *GroupService) InviteUserToGroup(groupID int, senderID int, invite models.InviteRequest) (models.Notification, error) {
	// ⬇️ CORRECTION : Vérifier si l'utilisateur est membre OU créateur
	isMember, err := s.Repo.IsUserMemberOfGroup(groupID, senderID)
	if err != nil {
		return models.Notification{}, fmt.Errorf("failed to check membership: %w", err)
	}
	
	if !isMember {
		return models.Notification{}, fmt.Errorf("not authorized: only group members can invite")
	}

	// Get group title for notification
	groupDetails, err := s.Repo.GetGroupDetailsByID(groupID, senderID)
	if err != nil {
		return models.Notification{}, fmt.Errorf("failed to get group details: %w", err)
	}

	// Get sender nickname for notification
	senderNickname, err := s.Repo.GetUserNickname(senderID)
	if err != nil {
		return models.Notification{}, fmt.Errorf("failed to get sender nickname: %w", err)
	}

	err = s.Repo.UpsertGroupInvitation(groupID, invite.UserID)
	if err != nil {
		return models.Notification{}, err
	}

	// Create and send notification to invited user
	notification := models.Notification{
		SenderID:       senderID,
		SenderNickname: senderNickname,
		GroupId:        groupID,
		Type:           "group_invitation",
		Message:        fmt.Sprintf("%s invited you to join the group: %s", senderNickname, groupDetails.Title),
		Seen:           false,
		CreatedAt:      time.Now().Format(time.RFC3339),
	}
	
	_, err = s.Repo.CreateNotification(invite.UserID, notification)
	if err != nil {
		return models.Notification{}, fmt.Errorf("failed to create notification: %w", err)
	}

	return notification, nil
}

func (s *GroupService) ApproveMembership(groupID int, creatorID int, body models.ApproveRequest, hub HubInterface) error {
	dbCreatorID, err := s.Repo.GetGroupCreatorID(groupID)
	if err != nil {
		return fmt.Errorf("group not found")
	}

	if dbCreatorID != creatorID {
		return fmt.Errorf("forbidden")
	}

	err = s.Repo.ApproveMembershipRequest(groupID, body.UserID)
	if err != nil {
		return err
	}

	// ⬇️ NOUVEAU : Invalider le cache des membres du groupe
	if hub != nil {
		hub.InvalidateGroupMembersCache(groupID)
		fmt.Printf("✅ Group %d cache invalidated after approving user %d\n", groupID, body.UserID)
	}

	return nil
}

func (s *GroupService) DeclineMembership(groupID int, creatorID int, body models.DeclineRequest) error {
	dbCreatorID, err := s.Repo.GetGroupCreatorID(groupID)
	if err != nil {
		return fmt.Errorf("group not found")
	}
	if dbCreatorID != creatorID {
		return fmt.Errorf("forbidden")
	}

	err = s.Repo.DeclineMembershipRequest(groupID, body.UserID)
	if err != nil {
		return err
	}
	return nil
}

func (s *GroupService) GetNonGroupMembers(groupID, userID int) ([]map[string]interface{}, error) {
	return s.Repo.GetNonGroupMembers(groupID, userID)
}

func (s *GroupService) GetGroupPosts(groupID, userID int) ([]models.GroupPost, error) {
	return s.Repo.GetGroupPosts(groupID, userID)
}

func (s *GroupService) IsGroupMember(groupID, userID int) (bool, error) {
	return s.Repo.IsGroupMember(groupID, userID)
}

func (s *GroupService) CreateGroupPost(post models.GroupPost) (*models.GroupPost, error) {
	return s.Repo.CreateGroupPost(post)
}

func (s *GroupService) GetGroupPostComments(postID, userID int) ([]models.GroupPostComment, error) {
	return s.Repo.GetGroupPostComments(postID, userID)
}

func (s *GroupService) CreateGroupPostComment(userID, postID int, content string) (models.GroupPostComment, error) {
	comment := models.GroupPostComment{
		PostID:   postID,
		AuthorID: userID,
		Content:  content,
	}

	created, err := s.Repo.CreateGroupPostComment(comment)
	if err != nil {
		return models.GroupPostComment{}, err
	}

	fullComment, err := s.Repo.GetGroupPostCommentByID(created.ID)
	if err != nil {
		return models.GroupPostComment{}, err
	}

	return fullComment, nil
}

func (s *GroupService) GetGroupEvents(userID, groupID int) ([]models.GroupEvent, error) {
	// Step 1: Check if user is a member or creator
	ok, err := s.Repo.IsGroupMember(groupID, userID)
	if !ok || err != nil {
		return nil, fmt.Errorf("membership check failed: %w", err)
	}
	events, err := s.Repo.GetGroupEvents(groupID, userID)
	if err != nil {
		return nil, err
	}
	return events, nil
}

func (s *GroupService) CreateGroupEvent(userID int, req models.CreateEventRequest) (models.GroupEvent, error) {
	// Check membership
	isMember, err := s.Repo.IsGroupMember(req.GroupID, userID)
	if err != nil {
		return models.GroupEvent{}, fmt.Errorf("membership check failed: %w", err)
	}
	if !isMember {
		return models.GroupEvent{}, ErrUnauthorized
	}

	// Parse date
	eventDate, err := time.Parse(time.RFC3339, req.EventDate)
	if err != nil {
		return models.GroupEvent{}, ErrInvalidDate
	}

	event := models.GroupEvent{
		GroupID:     req.GroupID,
		CreatorID:   userID,
		Title:       req.Title,
		Description: req.Description,
		EventDate:   eventDate,
	}

	createdEvent, err := s.Repo.CreateGroupEvent(event)
	if err != nil {
		return models.GroupEvent{}, err
	}

	fullEvent, err := s.Repo.GetGroupEventWithCreator(createdEvent.ID)
	if err != nil {
		return models.GroupEvent{}, err
	}

	return fullEvent, nil

}

func (s *GroupService) SendGroupMessage(userID int, groupID int, content string) (models.Message, error) {
	// Check if user is a member
	isMember, err := s.Repo.IsGroupMember(groupID, userID)
	if err != nil {
		return models.Message{}, fmt.Errorf("membership check failed: %w", err)
	}
	if !isMember {
		return models.Message{}, ErrUnauthorized
	}

	// Insert message
	_, err = s.Repo.InsertGroupMessage(groupID, userID, content)
	if err != nil {
		return models.Message{}, fmt.Errorf("insert failed: %w", err)
	}

	// Return message object
	return models.Message{
		From:      userID,
		GroupID:   groupID,
		Content:   content,
		Type:      "group",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *GroupService) GetGroupsForUser(userID int) ([]models.GroupWithStatus, error) {
	return s.Repo.GetAllGroups(userID)
}

func (s *GroupService) CreateGroup(userID int, req models.CreateGroupRequest) (models.Group, error) {
	group := models.Group{
		Name:        req.Title,
		Description: req.Description,
		OwnerID:     userID,
	}

	return s.Repo.CreateGroup(group)
}

// Add this to your service methods
func (s *GroupService) SetEventResponse(userID, eventID int, response string) error {
	// Validate response type
	if response != "going" && response != "not_going" {
		return fmt.Errorf("invalid response type")
	}

	// Get event to verify group membership
	event, err := s.Repo.GetGroupEventWithCreator(eventID)
	if err != nil {
		return fmt.Errorf("event lookup failed: %w", err)
	}

	// Check if user is member of the group
	isMember, err := s.Repo.IsGroupMember(event.GroupID, userID)
	if err != nil || !isMember {
		return ErrUnauthorized
	}

	// Set the response
	err = s.Repo.SetEventResponse(eventID, userID, response)
	if err != nil {
		return fmt.Errorf("failed to set response: %w", err)
	}

	return nil
}

func (s *GroupService) GetGroupMembers(groupID int) ([]models.GroupMember, error) {
	// Add any business logic/validation here before calling the Repository
	if groupID <= 0 {
		return nil, fmt.Errorf("invalid group ID")
	}

	// You might want to check if the group exists first
	exists, err := s.Repo.GroupExists(groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to check group existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("group not found")
	}

	// Call the Repository method
	members, err := s.Repo.GetGroupMembers(groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}

	// You could add additional processing here if needed
	// For example, filtering sensitive information, enriching data, etc.

	return members, nil
}

func (s *GroupService) GetGroupChatHistory(groupID, limit int) ([]models.GroupMessage, error) {
	return s.Repo.GetGroupChatHistory(groupID, limit)
}
