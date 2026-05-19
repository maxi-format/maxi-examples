# Sports Statistics API — Java / Quarkus

Mirrors `server-go`, `server-py`, `server-js`, and `server-php`.  
Wire format: `application/maxi`.  
Framework: [Quarkus 3](https://quarkus.io/) (Kubernetes-native Java, JAX-RS / RESTEasy Reactive).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/schema/{name}` | Serve a raw `.mxs` schema file |
| `GET` | `/players` | List all players |
| `GET` | `/players/{id}` | Get a single player |
| `POST` | `/players` | Create a player (MAXI body) |
| `PUT` | `/players/{id}` | Update a player (MAXI body) |
| `DELETE` | `/players/{id}` | Delete a player |
| `GET` | `/players/{id}/transfers` | Transfer history for a player |
| `GET` | `/teams` | List all teams |
| `GET` | `/teams/{id}` | Get a team with its roster |
| `GET` | `/games` | List all games |
| `GET` | `/games/{id}` | Get a game (with stats if available) |
| `GET` | `/transfers` | List all transfers (with inlined P/T records) |

## Running locally

```bash
# From the maxi-java directory, install the library first:
cd ../../maxi-java && mvn install -DskipTests

# Back in this directory:
cd ../../maxi-examples/server-java
mvn package -DskipTests
java -jar target/server-java-0.1.0-runner.jar
```

The server starts on port `8040` by default. Set `PORT` to override.

## Running with Docker

```bash
# From the repo root:
docker compose up server-java
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8040` | HTTP listen port |
