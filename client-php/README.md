# Sports Statistics API — PHP CLI Client

PHP CLI client for the Sports Statistics API, using **MAXI** as the wire format.
Demonstrates round-trip MAXI parsing including object reference resolution, POST/PUT
with MAXI request bodies, and nested array values.

Can talk to **any** of the three backend servers — they all speak the same `application/maxi`
wire format.

---

## Prerequisites

- PHP 8.1+
- Composer
- One of the backend servers running (JS :4000, Python :5000, or PHP :8080)

## Install

```bash
cd maxi-examples/client-php
composer install
```

## Run

```bash
# Against the JS server (default)
BASE_URL=http://localhost:8060 php client.php

# Against the Python server
BASE_URL=http://localhost:8070 php client.php

# Against the PHP server
BASE_URL=http://localhost:8080 php client.php

# Show raw MAXI request/response bodies for every call
VERBOSE=1 BASE_URL=http://localhost:8060 php client.php
```

## Run in Docker

Start the servers first, then run the client container:

```bash
cd maxi-examples
docker compose up -d server-js server-py server-php

# Default: PHP client → PHP server
docker compose run --rm client-php

# PHP client against the JS server
docker compose run --rm -e BASE_URL=http://server-js:4000 client-php

# PHP client against the Python server, verbose
docker compose run --rm -e BASE_URL=http://server-py:5000 -e VERBOSE=1 client-php
```

## What it demonstrates

1. **GET /players** — raw `Maxi::parse`, print positional values as a table
2. **GET /teams** — parse and display teams
3. **GET /teams/1** — multi-type response (team + roster)
4. **GET /games** — parse game records with score formatting
5. **GET /games/1** — `GameDetail` with nested `S[]` (PlayerStats arrays)
6. **GET /transfers** — object reference resolution: `P`/`T` records declared once, referenced
   inside `X` transfer records — the parser resolves them into full arrays automatically
7. **GET /players/3/transfers** — per-player transfer history
8. **POST /players** — build a MAXI request body with `Maxi::dump`, send it, parse the response
9. **PUT /players/:id** — update the just-created player, verify the position changed
