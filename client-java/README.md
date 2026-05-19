# Sports Statistics API — Java CLI Client

Mirrors `client-go`, `client-py`, `client-js`, and `client-php`.

Calls every server endpoint, prints the raw MAXI wire body, and shows a human-readable summary table or object dump.

Uses only `java.net.http.HttpClient` (built-in since Java 11) — zero external HTTP dependencies.

## Running locally

```bash
# From the maxi-java directory, install the library first (once):
cd ../../maxi-java && mvn install -DskipTests

# Build and run:
cd ../../maxi-examples/client-java
mvn package -DskipTests
BASE_URL=http://localhost:8040 java -jar target/client-java-1.0.0.jar
```

## Running with Docker

```bash
# From the repo root (server must be running):
docker compose --profile clients up client-java
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:8040` | Server base URL |
