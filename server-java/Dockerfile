# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /build

# Build the Quarkus uber-jar
COPY server-java/ ./
RUN mvn --no-transfer-progress package -DskipTests && \
    find target -maxdepth 1 -name 'server-java-*-runner.jar' -exec cp {} target/app.jar \;

# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/target/app.jar app.jar
COPY shared/ /app/shared/

EXPOSE 8040
ENV PORT=8040
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
