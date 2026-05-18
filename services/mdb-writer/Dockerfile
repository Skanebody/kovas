# Dockerfile pour Railway deploy du microservice mdb-writer
# Stub — sera complété Sprint MVP J12

FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /workspace/app

COPY gradle gradle
COPY gradlew .
COPY build.gradle .
COPY settings.gradle .

# Cache dependencies
RUN ./gradlew dependencies --no-daemon || true

COPY src src

RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app
COPY --from=builder /workspace/app/build/libs/*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-Xmx512m -XX:+UseG1GC"
ENTRYPOINT exec java $JAVA_OPTS -jar app.jar
