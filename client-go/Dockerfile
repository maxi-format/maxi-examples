# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS build
WORKDIR /src

COPY client-go/ ./

RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /client .

FROM scratch
COPY --from=build /client /app/client
COPY shared/ /app/shared/

ENV BASE_URL=http://server-go:8050
ENTRYPOINT ["/app/client"]
