# Dockerfile pour Frontend Next.js
FROM node:20-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier tout le code source
COPY . .

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED 1

# Builder l'application Next.js
RUN npm run build

# Stage 2: Image de production
FROM node:20-alpine AS runner

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Changer le propriétaire des fichiers
RUN chown -R nextjs:nodejs /app

# Utiliser l'utilisateur non-root
USER nextjs

# Exposer le port
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Lancer l'application
CMD ["node", "server.js"]
