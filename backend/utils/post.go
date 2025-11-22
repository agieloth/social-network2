package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"mime/multipart"
	"strings"
)

func IsValidImage(fileHeader *multipart.FileHeader) error {
	allowedTypes := []string{"image/jpeg", "image/png", "image/gif"}

	for _, t := range allowedTypes {
		if fileHeader.Header.Get("Content-Type") == t {
			return nil
		}
	}
	return errors.New("unsupported image format")
}

func GenerateFilename(original string) string {
	ext := ""
	parts := strings.Split(original, ".")
	if len(parts) > 1 {
		ext = parts[len(parts)-1]
	}
	return RandString(12) + "." + ext
}

func RandString(n int) string {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "random" // fallback
	}
	return hex.EncodeToString(bytes)[:n]
}
