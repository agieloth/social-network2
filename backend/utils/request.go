package utils

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

var (
	ErrInvalidID    = errors.New("invalid ID format")
	ErrMissingParam = errors.New("missing required parameter")
)

// ExtractIDFromPath extrait un ID numérique depuis un chemin URL
// Exemple : "/api/groups/123/members" avec prefix="/api/groups/" et suffix="/members" → 123
func ExtractIDFromPath(path, prefix, suffix string) (int, error) {
	idStr := strings.TrimPrefix(path, prefix)

	if suffix != "" {
		idStr = strings.TrimSuffix(idStr, suffix)
	}

	idStr = strings.Trim(idStr, "/")

	id, err := strconv.Atoi(idStr)
	if err != nil {
		return 0, ErrInvalidID
	}

	return id, nil
}

// ExtractQueryInt extrait un paramètre de query integer
func ExtractQueryInt(r *http.Request, paramName string) (int, error) {
	valueStr := r.URL.Query().Get(paramName)
	if valueStr == "" {
		return 0, ErrMissingParam
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return 0, ErrInvalidID
	}

	return value, nil
}

// ExtractQueryIntWithDefault extrait un paramètre de query integer avec valeur par défaut
func ExtractQueryIntWithDefault(r *http.Request, paramName string, defaultValue int) int {
	valueStr := r.URL.Query().Get(paramName)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}

	return value
}

// ExtractQueryString extrait un paramètre de query string
func ExtractQueryString(r *http.Request, paramName string) (string, error) {
	value := r.URL.Query().Get(paramName)
	if value == "" {
		return "", ErrMissingParam
	}
	return value, nil
}

// ExtractQueryStringWithDefault extrait un paramètre de query string avec valeur par défaut
func ExtractQueryStringWithDefault(r *http.Request, paramName, defaultValue string) string {
	value := r.URL.Query().Get(paramName)
	if value == "" {
		return defaultValue
	}
	return value
}

// ParseMultipartFormSafe parse un formulaire multipart avec gestion d'erreur
func ParseMultipartFormSafe(r *http.Request, maxMemory int64) error {
	if err := r.ParseMultipartForm(maxMemory); err != nil {
		return errors.New("failed to parse form")
	}
	return nil
}