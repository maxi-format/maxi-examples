# Sports Statistics API — PHP Server

PHP server that exposes a Sports Statistics API using **MAXI** as the wire format.
All responses (and accepted request bodies) are `Content-Type: application/maxi`.

Mirrors the Node.js server at [`../server-js/`](../server-js/) and the
Python server at [`../server-py/`](../server-py/).

---

## Prerequisites

- PHP 8.1+
- Composer
- The shared data files at `../shared/`

## Install

```bash
cd maxi-examples/server-php
composer install
```

## Run

```bash
php -S 0.0.0.0:8080 server.php
# Listening on http://localhost:8080
```

Set a custom port:

```bash
PORT=9000 php -S 0.0.0.0:9000 server.php
```

## Endpoints

| Method | Path                       | Description                                    |
|--------|----------------------------|------------------------------------------------|
| GET    | `/players`                 | All players                                    |
| GET    | `/players/<id>`            | Single player                                  |
| POST   | `/players`                 | Create player — body: `application/maxi`       |
| PUT    | `/players/<id>`            | Update a player — body: `application/maxi`     |
| GET    | `/players/<id>/transfers`  | Transfer history for one player (object refs)  |
| GET    | `/teams`                   | All teams                                      |
| GET    | `/teams/<id>`              | Team + roster                                  |
| GET    | `/games`                   | All games                                      |
| GET    | `/games/<id>`              | Game + detailed stats                          |
| GET    | `/transfers`               | All transfers (object references)              |

## Example — GET /players

```bash
curl http://localhost:8080/players
```

Response:
```
@schema:sports.mxs
###
P(1|Alice Müller|forward|1998|1)
P(2|Ben Nakamura|midfielder|1995|1)
...
```

## Example — POST /players

```bash
curl -X POST http://localhost:8080/players \
  -H "Content-Type: application/maxi" \
  --data $'@schema:sports.mxs\n###\nP(0|Luca Bianchi|forward|2001|1)'
```

The server assigns the next available `id` — the id in the request body is ignored.

## Data persistence

The server reads from and writes to `../shared/data/*.json`.
POST/PUT changes are persisted to disk so they survive between requests during a demo session.
