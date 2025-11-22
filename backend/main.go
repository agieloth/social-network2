package main

import (
	"fmt"
	"net/http"
	"os"
	"social/db/sqlite"
	"social/handlers"
	hubS "social/hub"
	"social/repositories"
	"social/services"
	"social/utils"
)

func main() {

	// 1. Initialize Database
	sqlite.InitDB()
	db := sqlite.GetDB()
	folderName := []string{
		"uploads/avatars",
		"uploads/group_posts",
	}

	for _, folder := range folderName {
		if err := os.MkdirAll(folder, os.ModePerm); err != nil {
			fmt.Printf("❌ Failed to create '%s': %v\n", folder, err)
			return
		}
	}

	// 2. Initialize Repositories (alphabetical order)
	authRepo := repositories.NewUserRepository(db)
	chatRepo := repositories.NewChatRepository(db)
	followRepo := repositories.NewFollowRepository(db)
	groupRepo := repositories.NewGroupRepository(db)
	notifRepo := repositories.NewNotificationRepository(db)
	postRepo := repositories.NewPostRepository(db)
	profileRepo := repositories.NewProfileRepository(db)
	sessionRepo := repositories.NewSessionRepo(db)

	// 3. Initialize Services (grouped by domain)
	// Authentication & Session
	authService := services.NewService(*authRepo)
	sessionService := services.NewSessionService(sessionRepo)

	// Chat & Messaging
	chatService := services.NewChatService(chatRepo)

	// Social Features
	followService := services.NewFollowService(followRepo, notifRepo)
	notifService := services.NewNotificationService(notifRepo)
	profileService := services.NewProfileService(*profileRepo)

	// Content Features
	groupService := services.NewGroupService(groupRepo)
	postService := services.NewPostService(postRepo)

	// 4. Initialize Hub with required services
	hub := hubS.NewHub(chatService)
	go hub.Run()

	// 5. Initialize Handlers
	authHandler := handlers.NewHandler(authService, sessionService, hub)
	chatHandler := handlers.NewChatHandler(chatService, sessionService)
	followHandler := handlers.NewFollowHandler(followService, sessionService, hub)
	groupHandler := handlers.NewGroupHandler(groupService, sessionService, hub)
	hubHandler := hubS.NewHandler(authService, sessionService, groupService, hub)
	notifHandler := handlers.NewNotificationHandler(notifService, sessionService)
	postHandler := handlers.NewPostHandler(postService, sessionService)
	profileHandler := handlers.NewProfileHandler(profileService, sessionService, hub)

	// 6. Setup Router
	mux := http.NewServeMux()

	// Authentication routes
	mux.HandleFunc("/api/login", authHandler.LoginHandler)
	mux.HandleFunc("/api/register", authHandler.RegisterHandler)
	mux.HandleFunc("/api/logout", authHandler.LogoutHandler)

	// User profile routes
	mux.HandleFunc("/api/profile/", profileHandler.ProfileHandler)
	mux.HandleFunc("/api/users/", profileHandler.GetUserByIDHandler)
	mux.HandleFunc("/api/search", profileHandler.SearchUsers)
	mux.HandleFunc("/api/user/toggle-privacy", profileHandler.TogglePrivacy)
	mux.HandleFunc("/api/auth/me", profileHandler.GetMe)

	// Post routes
	mux.Handle("/api/posts", utils.CorsMiddleware(http.HandlerFunc(postHandler.PostsHandler)))
	mux.HandleFunc("/api/user-posts/", postHandler.GetUserPostsHandler)
	mux.HandleFunc("/api/comments", postHandler.CreateCommentHandler)
	mux.HandleFunc("/api/comments/post", postHandler.GetCommentsByPostHandler)

	// Follow routes
	mux.HandleFunc("/api/follow", followHandler.SendFollowRequest)
	mux.HandleFunc("/api/follow/status/", followHandler.GetFollowStatus)
	mux.HandleFunc("/api/follow/accept", followHandler.AcceptFollow)
	mux.HandleFunc("/api/follow/reject", followHandler.RejectFollow)
	mux.HandleFunc("/api/unfollow", followHandler.UnfollowUser)
	mux.HandleFunc("/api/users-followers/", followHandler.GetFollowersHandler)
	mux.HandleFunc("/api/users-following/", followHandler.GetFollowingHandler)
	mux.HandleFunc("/api/recipients", followHandler.GetRecipientsHandler)

	// Chat routes
	mux.HandleFunc("/api/chat-users", chatHandler.GetAllChatUsers)
	mux.HandleFunc("/api/chat/history", chatHandler.GetChatHistory)

	// Notification routes
	mux.HandleFunc("/api/notifications", notifHandler.GetUserNotifications)
	mux.HandleFunc("/api/notifications/seen", notifHandler.MarkNotificationSeen)
	mux.HandleFunc("/api/notifications/delete", notifHandler.DeleteNotification)

	// Group routes
	mux.HandleFunc("/api/groups", groupHandler.DynamicMethods)
	mux.HandleFunc("/api/groups/", groupHandler.GroupRouterHandler)

	// WebSocket route
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("🧲 WebSocket connection initiated")
		hubHandler.ServeWS(hub, w, r)
	})

	// Static files route
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))

	// 7. Setup Middleware
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws" {
			// Bypass CORS for WebSocket
			mux.ServeHTTP(w, r)
			return
		}
		// Apply CORS to all other routes
		utils.CorsMiddleware(mux).ServeHTTP(w, r)
	})

	// 8. Start Server
	fmt.Println("✅ Server started on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		fmt.Printf("❌ Server error: %v\n", err)
	}
}
