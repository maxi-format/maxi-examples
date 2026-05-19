# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS build
WORKDIR /src

# Copy server source
COPY server-go/ ./

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server .

# ---------------------------------------------------------------------------
FROM alpine:3.21
COPY --from=build /server /app/server
# Shared data/schema files are mounted at runtime (see docker-compose.yml)
COPY shared/ /app/shared/

EXPOSE 8050
ENV PORT=8050
ENTRYPOINT ["/app/server"]
