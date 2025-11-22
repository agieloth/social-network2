package utils

func PrepareAvatarURL(path string) string {
	if path == "" {
		return ""
	}
	return "http://localhost:8080/" + path
}