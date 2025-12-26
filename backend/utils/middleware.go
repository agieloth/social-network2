package utils

import (
	"context"
	"net/http"
	"social/services"
)

// CorsMiddleware gère les CORS pour permettre les requêtes depuis le frontend
func CorsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// AuthMiddleware vérifie l'authentification et injecte l'userID dans le contexte
func AuthMiddleware(sessionService *services.SessionService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := sessionService.GetUserIDFromSession(r)
			if err != nil {
				WriteError(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			ctx := context.WithValue(r.Context(), "userID", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserIDFromContext récupère l'userID depuis le contexte
func GetUserIDFromContext(ctx context.Context) (int, bool) {
	userID, ok := ctx.Value("userID").(int)
	return userID, ok
}
