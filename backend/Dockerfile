# Dockerfile pour Backend Go
FROM golang:1.23-alpine AS builder

# Installer les dépendances nécessaires
RUN apk add --no-cache git gcc musl-dev sqlite-dev

# Définir le répertoire de travail
WORKDIR /app

# Copier go.mod et go.sum
COPY go.mod go.sum ./

# Télécharger les dépendances
RUN go mod download

# Copier tout le code source
COPY . .

# Compiler l'application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Image finale légère
FROM alpine:latest

# Installer les dépendances runtime
RUN apk --no-cache add ca-certificates sqlite-libs

WORKDIR /root/

# Copier le binaire depuis le builder
COPY --from=builder /app/main .

# ⬇️ NOUVEAU: Copier les migrations
COPY --from=builder /app/db ./db

# Créer les dossiers nécessaires
RUN mkdir -p uploads/avatars uploads/posts uploads/group_posts

# Exposer le port
EXPOSE 8080

# Lancer l'application
CMD ["./main"]
