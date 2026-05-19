# Sports Statistics API — Python Server

Flask server that exposes a Sports Statistics API using **MAXI** as the wire format.
All responses (and accepted request bodies) are `Content-Type: application/maxi`.

Mirrors the Node.js server at [`../server-js/`](../server-js/).

---

## Prerequisites

- Python 3.10+
- Internet access for `pip install` (fetches `maxi` from [github:maxi-format/maxi-python](https://github.com/maxi-format/maxi-python))
- The shared data files at `../shared/`

## Install

```bash
cd maxi-examples/server-py
pip install -r requirements.txt
```

## Run

```bash
python server.py
# Listening on http://localhost:5000
```

Set a custom port:

```bash
PORT=6000 python server.py
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
curl http://localhost:5000/players     # local
curl http://localhost:8070/players     # via Docker Compose
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
curl -X POST http://localhost:5000/players \
  -H "Content-Type: application/maxi" \
  --data $'@schema:sports.mxs\n###\nP(0|Luca Bianchi|forward|2001|1)'
```

The server assigns the next available `id` — the id in the request body is ignored.

## Data persistence

The server reads from and writes to `../shared/data/*.json`.
POST/PUT changes are persisted to disk so they survive between requests during a demo session.
