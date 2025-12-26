package main

import (
	"fmt"
	"net/http"
	"os"
	"social/db/sqlite"
	"social/handlers"
	"social/handlers/group"
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
	groupHandler := group.NewHandler(groupService, sessionService, hub)
	hubHandler := hubS.NewHandler(authService, sessionService, groupService, hub)
	notifHandler := handlers.NewNotificationHandler(notifService, sessionService)
	postHandler := handlers.NewPostHandler(postService, sessionService)
	profileHandler := handlers.NewProfileHandler(profileService, sessionService, hub)

	// 6. Create Auth Middleware
	authMiddleware := utils.AuthMiddleware(sessionService)

	// 7. Setup Router
	mux := http.NewServeMux()

	// Authentication routes (NON protégées)
	mux.HandleFunc("/api/login", authHandler.LoginHandler)
	mux.HandleFunc("/api/register", authHandler.RegisterHandler)
	mux.HandleFunc("/api/logout", authHandler.LogoutHandler)

	// User profile routes (PROTÉGÉES)
	mux.Handle("/api/profile/", authMiddleware(http.HandlerFunc(profileHandler.ProfileHandler)))
	mux.Handle("/api/users/", authMiddleware(http.HandlerFunc(profileHandler.GetUserByIDHandler)))
	mux.Handle("/api/search", authMiddleware(http.HandlerFunc(profileHandler.SearchUsers)))
	mux.Handle("/api/user/toggle-privacy", authMiddleware(http.HandlerFunc(profileHandler.TogglePrivacy)))
	mux.Handle("/api/auth/me", authMiddleware(http.HandlerFunc(profileHandler.GetMe)))

	// Post routes (PROTÉGÉES)
	mux.Handle("/api/posts", authMiddleware(http.HandlerFunc(postHandler.PostsHandler)))
	mux.Handle("/api/user-posts/", authMiddleware(http.HandlerFunc(postHandler.GetUserPostsHandler)))
	mux.Handle("/api/comments", authMiddleware(http.HandlerFunc(postHandler.CreateCommentHandler)))
	mux.Handle("/api/comments/post", authMiddleware(http.HandlerFunc(postHandler.GetCommentsByPostHandler)))

	// Follow routes (PROTÉGÉES)
	mux.Handle("/api/follow", authMiddleware(http.HandlerFunc(followHandler.SendFollowRequest)))
	mux.Handle("/api/follow/status/", authMiddleware(http.HandlerFunc(followHandler.GetFollowStatus)))
	mux.Handle("/api/follow/accept", authMiddleware(http.HandlerFunc(followHandler.AcceptFollow)))
	mux.Handle("/api/follow/reject", authMiddleware(http.HandlerFunc(followHandler.RejectFollow)))
	mux.Handle("/api/unfollow", authMiddleware(http.HandlerFunc(followHandler.UnfollowUser)))
	mux.Handle("/api/users-followers/", authMiddleware(http.HandlerFunc(followHandler.GetFollowersHandler)))
	mux.Handle("/api/users-following/", authMiddleware(http.HandlerFunc(followHandler.GetFollowingHandler)))
	mux.Handle("/api/recipients", authMiddleware(http.HandlerFunc(followHandler.GetRecipientsHandler)))

	// Chat routes (PROTÉGÉES)
	mux.Handle("/api/chat-users", authMiddleware(http.HandlerFunc(chatHandler.GetAllChatUsers)))
	mux.Handle("/api/chat/history", authMiddleware(http.HandlerFunc(chatHandler.GetChatHistory)))

	// Notification routes (PROTÉGÉES)
	mux.Handle("/api/notifications", authMiddleware(http.HandlerFunc(notifHandler.GetUserNotifications)))
	mux.Handle("/api/notifications/seen", authMiddleware(http.HandlerFunc(notifHandler.MarkNotificationSeen)))
	mux.Handle("/api/notifications/delete", authMiddleware(http.HandlerFunc(notifHandler.DeleteNotification)))

	// Group routes (PROTÉGÉES)
	mux.Handle("/api/groups", authMiddleware(http.HandlerFunc(groupHandler.DynamicMethods)))
	mux.Handle("/api/groups/", authMiddleware(http.HandlerFunc(groupHandler.GroupRouterHandler)))

	// WebSocket route (NON protégée - auth gérée en interne)
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("🧲 WebSocket connection initiated")
		hubHandler.ServeWS(hub, w, r)
	})

	// Static files route (NON protégée)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))

	// 8. Setup Middleware
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws" {
			// Bypass CORS for WebSocket
			mux.ServeHTTP(w, r)
			return
		}
		// Apply CORS to all other routes
		utils.CorsMiddleware(mux).ServeHTTP(w, r)
	})

	// 9. Start Server
	fmt.Println("✅ Server started on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		fmt.Printf("❌ Server error: %v\n", err)
	}
}