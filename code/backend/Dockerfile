# ==============================================================================
# Stage 1: Build Spring Boot JAR with Maven
# ==============================================================================
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Mise en cache des dépendances Maven
COPY pom.xml .
RUN mvn dependency:resolve -B

# Compilation et empaquetage de l'application
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==============================================================================
# Stage 2: Runtime Image (Temurin JRE 17 Alpine)
# ==============================================================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Installation de Chromium et des polices nécessaires au rendu PDF headless A4
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-cjk

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROMIUM_BIN=/usr/bin/chromium-browser

# Sécurité : utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copie du binaire compilé
COPY --from=builder /build/target/*.jar app.jar

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8081

ENV JAVA_OPTS="-Xms256m -Xmx768m -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8081/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
