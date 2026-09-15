# ==============================================================================
# Stage 1: Build Angular application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (utilisant cache de couche Docker)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build de l'application Angular
COPY . .
RUN npm run build -- --configuration=production

# ==============================================================================
# Stage 2: Serve with Nginx
# ==============================================================================
FROM nginx:1.25-alpine

# Purge des fichiers statiques Nginx par défaut
RUN rm -rf /usr/share/nginx/html/*

# Copie du build de production Angular
COPY --from=builder /app/dist/dashboard/browser /usr/share/nginx/html

# Configuration Nginx personnalisée avec proxy vers backend Spring Boot et support SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
