package utils

import (
	"encoding/json"
	"net/http"
)

// WriteJSON envoie une réponse JSON avec le statut spécifié
func WriteJSON(w http.ResponseWriter, status int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

// WriteError envoie une erreur au format JSON
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{
		"error": message,
	})
}

// WriteSuccess envoie un message de succès au format JSON
func WriteSuccess(w http.ResponseWriter, message string) {
	WriteJSON(w, http.StatusOK, map[string]string{
		"message": message,
	})
}

// WriteCreated envoie une réponse de création réussie
func WriteCreated(w http.ResponseWriter, data interface{}) error {
	return WriteJSON(w, http.StatusCreated, data)
}

// ErrorResponse structure pour les réponses d'erreur détaillées
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

// WriteDetailedError envoie une erreur avec plus de détails
func WriteDetailedError(w http.ResponseWriter, status int, err ErrorResponse) {
	WriteJSON(w, status, err)
}