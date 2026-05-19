# Sports Statistics API — JavaScript/Node.js Server

Express 5 server that exposes a Sports Statistics API using **MAXI** as the wire format.
All responses (and accepted request bodies) are `Content-Type: application/maxi`.

---

## Prerequisites

- Node.js 20+
- Internet access for `npm install` (fetches `maxi` from [github:maxi-format/maxi-javascript](https://github.com/maxi-format/maxi-javascript))
- The shared data files at `../shared/`

> **Note:** The `maxi` package on GitHub currently ships without a pre-built `index.js`.
> A `postinstall` script in `package.json` creates the missing shim automatically after
> `npm install`. Once the package publishes a proper build this workaround can be removed.

## Install

```bash
cd maxi-examples/server-js
npm install
```

## Run

```bash
node server.js
# Listening on http://localhost:4000
# Via Docker Compose: http://localhost:8060
```

Set a custom port:

```bash
PORT=4000 node server.js
```

## Endpoints

| Method | Path                     | Description                                        |
|--------|--------------------------|----------------------------------------------------|
| GET    | `/players`               | All players                                        |
| GET    | `/players/:id`           | Single player                                      |
| POST   | `/players`               | Create player(s) — body: `application/maxi`    |
| PUT    | `/players/:id`           | Update a player — body: `application/maxi`     |
| GET    | `/players/:id/transfers` | Transfer history for one player (object refs)      |
| GET    | `/teams`                 | All teams                                          |
| GET    | `/teams/:id`             | Team + roster                                      |
| GET    | `/games`                 | All games                                          |
| GET    | `/games/:id`             | Game + detailed stats                              |
| GET    | `/transfers`             | All transfers (object references)                  |

## Example — GET /players

```bash
curl http://localhost:4000/players        # local
curl http://localhost:8060/players        # via Docker Compose
```

Response:
```
@schema:sports.mxs

P:Player(id:int|name(!)|position:...|birthYear:int|teamId:int)
###
P(1|Alice Müller|forward|1998|1)
P(2|Ben Nakamura|midfielder|1995|1)
...
```

## Example — POST /players

```bash
curl -X POST http://localhost:4000/players \
  -H "Content-Type: application/maxi" \
  --data $'@schema:sports.mxs\n###\nP(0|Luca Bianchi|forward|2001|1)'
```

The server assigns the next available `id` — the id in the request body is ignored.

## Example — GET /transfers (object references)

```bash
curl http://localhost:4000/transfers
```

Players and teams are declared once, then referenced by id in each `X` transfer record:

```
@schema:sports.mxs

P:Player(...)
T:Team(...)
X:Transfer(id:int|player:P|fromTeam:T|toTeam:T|date@date(!)|fee:decimal)
###
X(1|3|2|1|2024-07-01|4500000)
X(2|5|1|2|2025-01-15|7200000)
X(3|2|2|1|2025-06-30|~)
P(2|Ben Nakamura|midfielder|1995|1)
P(5|Elias Boateng|forward|1999|2)
P(3|Carlos Rivera|defender|2000|1)
T(2|Storm United|Amsterdam|1948|Yuki Tanaka)
T(1|Thunder FC|Berlin|1923|Marco Rossi)
```

## Use with any MAXI client

Point any client at this server using the `BASE_URL` environment variable:

```bash
# JS CLI client
BASE_URL=http://localhost:4000 node ../client-js/client.js

# Python client
BASE_URL=http://localhost:4000 python ../client-py/client.py

# PHP client
BASE_URL=http://localhost:4000 php ../client-php/client.php
```

## Data persistence

The server reads from and writes to `../shared/data/*.json`.
POST/PUT changes are persisted to disk so they survive between requests during a demo session.
