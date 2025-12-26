package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
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

func (h *Handler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := utils.ParseMultipartFormSafe(r, 10<<20); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid form")
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

	// Upload avatar optionnel
	avatarPath, err := utils.HandleOptionalFileUpload(
		r,
		"avatar",
		utils.DefaultImageUploadConfig("uploads/avatars"),
	)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to upload avatar: "+err.Error())
		return
	}
	form.Avatar = avatarPath

	// Déléguer au service
	err = h.authService.Register(form)
	if err != nil {
		utils.WriteError(w, http.StatusConflict, "Could not register: "+err.Error())
		return
	}

	utils.WriteSuccess(w, "Registered successfully")
}

func (h *Handler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("from login")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	user, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	sessionID, expiration, err := h.sessionService.CreateSession(user.ID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Could not create session")
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

	utils.WriteJSON(w, http.StatusOK, user)
}

func (h *Handler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_id")
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "No session cookie found")
		return
	}

	// Utiliser le service au lieu d'accès direct à la DB
	err = h.sessionService.DeleteSession(cookie.Value)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to log out")
		return
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
	})

	utils.WriteSuccess(w, "Logged out successfully")
}