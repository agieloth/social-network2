// services/post_service.go
package services

import (
	"social/models"
	"social/repositories"
	"sort"
	"time"
)

type PostService struct {
	repo *repositories.PostRepository
}

func NewPostService(repo *repositories.PostRepository) *PostService {
	return &PostService{repo: repo}
}

// services/post_service.go
func (s *PostService) GetUserPosts(authorID, currentUserID int) ([]models.PostFetch, error) {
	// If user is viewing their own posts, return all posts
	if authorID == currentUserID {
		return s.repo.GetAllPostsByUserID(authorID)
	}

	// Check if the account is private
	isPrivate, err := s.repo.IsAccountPrivate(authorID)
	if err != nil {
		return nil, err
	}

	// If account is private and current user is not following, return nothing
	if isPrivate {
		isFollowing, err := s.repo.IsUserFollowing(authorID, currentUserID)
		if err != nil {
			return nil, err
		}
		if !isFollowing {
			return []models.PostFetch{}, nil
		}
	}

	// Get public posts
	publicPosts, err := s.repo.GetPublicPostsByUserID(authorID)
	if err != nil {
		return nil, err
	}

	// Get followers-only posts if current user is following
	var followersPosts []models.PostFetch
	isFollowing, err := s.repo.IsUserFollowing(authorID, currentUserID)
	if err != nil {
		return nil, err
	}
	if isFollowing {
		followersPosts, err = s.repo.GetFollowersPostsByUserID(authorID)
		if err != nil {
			return nil, err
		}
	}

	// Get custom posts where current user has permission
	customPosts, err := s.repo.GetCustomPostsForUser(authorID, currentUserID)
	if err != nil {
		return nil, err
	}

	// Combine all posts
	allPosts := append(publicPosts, followersPosts...)
	allPosts = append(allPosts, customPosts...)

	// Sort by created_at descending
	sort.Slice(allPosts, func(i, j int) bool {
		return allPosts[i].CreatedAt.After(allPosts[j].CreatedAt)
	})

	return allPosts, nil
}

func (s *PostService) CreatePost(authorID int, content, imageURL, privacy string, recipientIDs []int) error {
	post := models.PostFetch{
		AuthorID:  authorID,
		Content:   content,
		ImageURL:  imageURL,
		Privacy:   privacy,
		CreatedAt: time.Now(),
	}
	return s.repo.CreatePost(post, recipientIDs)
}

func (s *PostService) GetPostsForUser(userID int) ([]models.PostFetch, error) {
	return s.repo.GetPostsForUser(userID)
}

func (s *PostService) GetCommentsByPost(postID string) ([]models.CommentWithUser, error) {
	return s.repo.GetCommentsByPost(postID)
}

func (s *PostService) CreateComment(postID string, userID int, content, image string) error {
	createdAt := time.Now().Format("2006-01-02 15:04:05")
	return s.repo.InsertComment(postID, userID, content, image, createdAt)
}
