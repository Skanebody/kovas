# KOVAS — mdb-writer microservice Dockerfile (Railway-ready)
#
# Multi-stage build:
#   - builder : gradle:8-jdk21-alpine compiles bootJar
#   - runtime : eclipse-temurin:21-jre-alpine runs app.jar
#
# No local Gradle wrapper required — image provides it. Founder can also run
# `./gradlew bootRun` locally once `gradle wrapper --gradle-version 8.10` is
# initialized once.

FROM gradle:8-jdk21-alpine AS builder
WORKDIR /workspace/app

# Copy build config first for layer caching
COPY build.gradle settings.gradle ./

# Resolve dependencies (separate layer)
RUN gradle --no-daemon dependencies > /dev/null 2>&1 || true

COPY src ./src

RUN gradle --no-daemon bootJar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S kovas && adduser -S -G kovas kovas
USER kovas

COPY --from=builder --chown=kovas:kovas /workspace/app/build/libs/app.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-Xmx512m -XX:+UseG1GC -XX:MaxRAMPercentage=75.0"

# Railway sets PORT env var dynamically; Spring Boot honors server.port=${PORT:8080}.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
