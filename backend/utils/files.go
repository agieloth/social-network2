package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	ErrNoFile          = errors.New("no file provided")
	ErrInvalidFileType = errors.New("invalid file type")
	ErrFileTooLarge    = errors.New("file too large")
	ErrUploadFailed    = errors.New("failed to upload file")
)

// UploadConfig définit la configuration pour l'upload
type UploadConfig struct {
	MaxSize      int64
	AllowedTypes []string
	UploadDir    string
}

// DefaultImageUploadConfig retourne une config par défaut pour les images
func DefaultImageUploadConfig(uploadDir string) UploadConfig {
	return UploadConfig{
		MaxSize: 10 << 20, // 10 MB
		AllowedTypes: []string{
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/gif",
			"image/webp",
		},
		UploadDir: uploadDir,
	}
}

// HandleFileUpload gère l'upload d'un fichier depuis un formulaire multipart
func HandleFileUpload(r *http.Request, fieldName string, config UploadConfig) (string, error) {
	file, header, err := r.FormFile(fieldName)
	if err != nil {
		if err == http.ErrMissingFile {
			return "", ErrNoFile
		}
		return "", fmt.Errorf("failed to get file: %w", err)
	}
	defer file.Close()

	if !isValidFileType(header, config.AllowedTypes) {
		return "", ErrInvalidFileType
	}

	if config.MaxSize > 0 && header.Size > config.MaxSize {
		return "", ErrFileTooLarge
	}

	filename := generateUniqueFilename(header.Filename)
	fullPath := filepath.Join(config.UploadDir, filename)

	if err := os.MkdirAll(config.UploadDir, os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	dst, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return "/" + fullPath, nil
}

// isValidFileType vérifie si le type MIME du fichier est autorisé
func isValidFileType(header *multipart.FileHeader, allowedTypes []string) bool {
	contentType := header.Header.Get("Content-Type")

	for _, allowed := range allowedTypes {
		if contentType == allowed {
			return true
		}
	}

	return false
}

// generateUniqueFilename génère un nom de fichier unique
func generateUniqueFilename(originalName string) string {
	ext := filepath.Ext(originalName)
	timestamp := time.Now().UnixNano()
	random := RandString(8)

	return fmt.Sprintf("%d_%s%s", timestamp, random, ext)
}

// HandleOptionalFileUpload gère un upload optionnel
func HandleOptionalFileUpload(r *http.Request, fieldName string, config UploadConfig) (string, error) {
	path, err := HandleFileUpload(r, fieldName, config)

	if err == ErrNoFile || err == http.ErrMissingFile {
		return "", nil
	}

	return path, err
}

// RandString génère une chaîne aléatoire (déjà existant dans post.go)
func RandString(n int) string {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "random"
	}
	return hex.EncodeToString(bytes)[:n]
}

// IsValidImage vérifie si le fichier est une image valide (déjà existant dans post.go)
func IsValidImage(fileHeader *multipart.FileHeader) error {
	allowedTypes := []string{"image/jpeg", "image/png", "image/gif"}

	for _, t := range allowedTypes {
		if fileHeader.Header.Get("Content-Type") == t {
			return nil
		}
	}
	return errors.New("unsupported image format")
}

// GenerateFilename génère un nom de fichier (déjà existant dans post.go)
func GenerateFilename(original string) string {
	ext := ""
	parts := strings.Split(original, ".")
	if len(parts) > 1 {
		ext = parts[len(parts)-1]
	}
	return RandString(12) + "." + ext
}