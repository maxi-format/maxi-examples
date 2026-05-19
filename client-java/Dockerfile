# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /build

# Build the client
COPY client-java/ ./
RUN mvn --no-transfer-progress package -DskipTests && \
    find target -maxdepth 1 -name 'client-java-*.jar' ! -name '*-sources.jar' -exec cp {} target/app.jar \;

# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/target/app.jar app.jar
COPY --from=build /build/target/lib/ lib/
COPY shared/ /app/shared/

ENV BASE_URL=http://localhost:8040
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
