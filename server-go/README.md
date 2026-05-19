# Sports Statistics API — Go server
A pure-stdlib Go implementation of the MAXI Sports Statistics API, mirroring
`server-py` and `server-js`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/players` | All players |
| GET | `/players/:id` | Single player |
| POST | `/players` | Create player (MAXI body) |
| PUT | `/players/:id` | Update player (MAXI body) |
| DELETE | `/players/:id` | Delete player |
| GET | `/players/:id/transfers` | Player transfer history |
| GET | `/teams` | All teams |
| GET | `/teams/:id` | Team + roster |
| GET | `/games` | All games |
| GET | `/games/:id` | Game with stats |
| GET | `/transfers` | All transfers |
| GET | `/schema/:name` | Serve schema file |

## Run locally

```bash
cd maxi-examples/server-go
PORT=8050 go run .
```

## Docker

```bash
docker compose up server-go
```
