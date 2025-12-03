package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"social/db/sqlite"
	"social/hub"
	"social/models"
	"social/services"
	"social/utils"
)

type Handler struct {
	authService    *services.AuthService
	sessionService *services.SessionService
	Hub            *hub.Hub
}

func NewHandler(service *services.AuthService, sessionService *services.SessionService, hub *hub.Hub) *Handler {
	return &Handler{authService: service, sessionService: sessionService, Hub: hub}
}

// handler/auth_handler.go
func (h *Handler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "Error parsing form", http.StatusBadRequest)
		return
	}

	form := models.RegisterRequest{
		Email:       r.FormValue("email"),
		Password:    r.FormValue("password"),
		FirstName:   r.FormValue("first_name"),
		LastName:    r.FormValue("last_name"),
		DateOfBirth: r.FormValue("date_of_birth"),
		Nickname:    r.FormValue("nickname"),
		About:       r.FormValue("about"),
	}

	// Handle avatar upload
	file, header, err := r.FormFile("avatar")
	if err == nil {
		defer file.Close()

		avatarPath := "uploads/avatars/" + header.Filename
		out, err := os.Create(avatarPath)
		if err != nil {
			http.Error(w, "Unable to save avatar", http.StatusInternalServerError)
			return
		}
		defer out.Close()

		_, err = io.Copy(out, file)
		if err != nil {
			http.Error(w, "Failed to write avatar", http.StatusInternalServerError)
			return
		}
		form.Avatar = avatarPath
	} else {
		form.Avatar = ""
	}

	// Delegate to service
	err = h.authService.Register(form)
	if err != nil {
		http.Error(w, "Registration failed, email already in use", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte("✅ Registered successfully"))
}

func (h *Handler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("from login")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	user, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	sessionID, expiration, err := h.sessionService.CreateSession(user.ID)
	if err != nil {
		http.Error(w, "Could not create session", http.StatusInternalServerError)
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Expires:  expiration,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	user.Avatar = utils.PrepareAvatarURL(user.Avatar)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	db := sqlite.DB
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "No session cookie found", http.StatusUnauthorized)
		return
	}
	_, err = db.Exec(`DELETE FROM sessions WHERE id = ?`, cookie.Value)
	if err != nil {
		http.Error(w, "Failed to log out", http.StatusInternalServerError)
		return
	}
	// Clear cookie by setting MaxAge to -1
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // Pour s'assurer que les cookies sont bien envoyés au frontend
		Secure:   false,
	})

	w.Write([]byte("✅ Logged out successfully"))
}
