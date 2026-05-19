# Sports Statistics API — Python CLI Client

Python CLI client for the Sports Statistics API, using **MAXI** as the wire format.
Uses only the standard library (`urllib`) for HTTP — no extra HTTP dependency needed.

Mirrors the Node.js client at [`../client-js/`](../client-js/).

Can talk to **any** of the three backend servers — they all speak the same `application/maxi`
wire format.

---

## Prerequisites

- Python 3.10+
- One of the backend servers running (JS :4000, Python :5000, or PHP :8080)

## Install

```bash
cd maxi-examples/client-py
pip install -r requirements.txt
```

## Run

```bash
# Against the JS server (default)
BASE_URL=http://localhost:8060 python client.py

# Against the Python server
BASE_URL=http://localhost:8070 python client.py

# Against the PHP server
BASE_URL=http://localhost:8080 python client.py

# Show raw MAXI request/response bodies for every call
VERBOSE=1 BASE_URL=http://localhost:8060 python client.py
```

## Run in Docker

Start the servers first, then run the client container:

```bash
cd maxi-examples
docker compose up -d server-js server-py server-php

# Default: Python client → Python server
docker compose run --rm client-py

# Python client against the JS server
docker compose run --rm -e BASE_URL=http://server-js:4000 client-py

# Python client against the PHP server, verbose
docker compose run --rm -e BASE_URL=http://server-php:8080 -e VERBOSE=1 client-py
```

## What it demonstrates

1. **GET /players** — raw `parse_maxi`, print positional values as a table
2. **GET /teams** — parse and display teams
3. **GET /teams/1** — multi-type response (team + roster)
4. **GET /games** — parse game records with score formatting
5. **GET /games/1** — `GameDetail` with nested `S[]` (PlayerStats arrays)
6. **GET /transfers** — object reference resolution: `P`/`T` records declared once, referenced
   inside `X` transfer records — the parser resolves them into full dicts automatically
7. **GET /players/3/transfers** — per-player transfer history
8. **POST /players** — build a MAXI request body with `dump_maxi`, send it, parse the response
9. **PUT /players/:id** — update the just-created player, verify the position changed
