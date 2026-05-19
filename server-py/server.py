"""
server.py — Sports Statistics API (Python / Flask)
Wire format: application/maxi  (https://github.com/maxi-format/maxi-python)

Mirrors the endpoints of ../server-js/server.js.
"""

import asyncio
import os
import re
from pathlib import Path

from flask import Flask, Response, abort, request, send_from_directory

from maxi import dump_maxi, parse_maxi

from data_loader import (
    load_game_by_id,
    load_game_stats_by_game_id,
    load_games,
    load_player_by_id,
    load_players,
    load_team_by_id,
    load_teams,
    load_transfers_with_refs,
    save_players,
)

SHARED = Path(__file__).parent.parent / "shared"
PORT = int(os.environ.get("PORT", 5000))

# ---------------------------------------------------------------------------
# Type definitions (mirror sports.mxs — used by dump_maxi)
# ---------------------------------------------------------------------------

T_PLAYER = {
    "alias": "P", "name": "Player",
    "fields": [
        {"name": "id",        "typeExpr": "int"},
        {"name": "name",      "constraints": [{"type": "required"}]},
        {"name": "position",  "typeExpr": "enum[forward,midfielder,defender,goalkeeper]"},
        {"name": "birthYear", "typeExpr": "int"},
        {"name": "teamId",    "typeExpr": "int"},
    ],
}

T_TEAM = {
    "alias": "T", "name": "Team",
    "fields": [
        {"name": "id",      "typeExpr": "int"},
        {"name": "name",    "constraints": [{"type": "required"}]},
        {"name": "city",    "constraints": [{"type": "required"}]},
        {"name": "founded", "typeExpr": "int"},
        {"name": "coach",   "constraints": [{"type": "required"}]},
    ],
}

T_STATS = {
    "alias": "S", "name": "PlayerStats",
    "fields": [
        {"name": "playerId",      "typeExpr": "int"},
        {"name": "goals",         "typeExpr": "int", "defaultValue": 0},
        {"name": "assists",       "typeExpr": "int", "defaultValue": 0},
        {"name": "minutesPlayed", "typeExpr": "int", "defaultValue": 0},
    ],
}

T_GAME = {
    "alias": "G", "name": "Game",
    "fields": [
        {"name": "id",         "typeExpr": "int"},
        {"name": "homeTeamId", "typeExpr": "int"},
        {"name": "awayTeamId", "typeExpr": "int"},
        {"name": "date",       "annotation": "date", "constraints": [{"type": "required"}]},
        {"name": "status",     "typeExpr": "enum[scheduled,live,finished,cancelled]"},
        {"name": "homeScore",  "typeExpr": "int", "defaultValue": 0},
        {"name": "awayScore",  "typeExpr": "int", "defaultValue": 0},
    ],
}

T_GAME_DETAIL = {
    "alias": "D", "name": "GameDetail",
    "fields": [
        {"name": "gameId",      "typeExpr": "int"},
        {"name": "homePlayers", "typeExpr": "S[]"},
        {"name": "awayPlayers", "typeExpr": "S[]"},
    ],
}

T_TRANSFER = {
    "alias": "X", "name": "Transfer",
    "fields": [
        {"name": "id",       "typeExpr": "int"},
        {"name": "player",   "typeExpr": "P"},
        {"name": "fromTeam", "typeExpr": "T"},
        {"name": "toTeam",   "typeExpr": "T"},
        {"name": "date",     "annotation": "date", "constraints": [{"type": "required"}]},
        {"name": "fee",      "typeExpr": "decimal"},
    ],
}

# ---------------------------------------------------------------------------
# Helper: build a MAXI response
# ---------------------------------------------------------------------------

def load_schema(name: str) -> str:
    return (SHARED / name).read_text(encoding="utf-8")


def maxi_response(data, alias: str, types: list, status: int = 200) -> Response:
    body = dump_maxi(
        data,
        schema_file="sports.mxs",
        default_alias=alias,
        types=types,
        include_types=False,
        collect_references=True,
    )
    return Response(body, status=status, content_type="application/maxi")


def maxi_not_found() -> Response:
    return Response("", status=404, content_type="application/maxi")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = Flask(__name__)


@app.after_request
def add_cors(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def options_handler(path):
    return Response("", status=204)


# ---------------------------------------------------------------------------
# Schema file endpoint
# ---------------------------------------------------------------------------

@app.get("/schema/<name>")
def get_schema(name: str):
    safe = re.sub(r"[^a-zA-Z0-9._-]", "", name)
    schema_path = SHARED / safe
    if not schema_path.exists():
        abort(404)
    return Response(
        schema_path.read_text(encoding="utf-8"),
        content_type="text/plain; charset=utf-8",
    )


# ---------------------------------------------------------------------------
# Players
# ---------------------------------------------------------------------------

@app.get("/players")
def get_players():
    return maxi_response(load_players(), "P", [T_PLAYER])


@app.get("/players/<int:player_id>")
def get_player(player_id: int):
    player = load_player_by_id(player_id)
    if player is None:
        return maxi_not_found()
    return maxi_response([player], "P", [T_PLAYER])


@app.post("/players")
def create_player():
    body = request.get_data(as_text=True)
    parsed = asyncio.run(parse_maxi(body, load_schema=load_schema))
    players = load_players()
    new_id = max((p["id"] for p in players), default=0) + 1
    v = parsed.records[0].values
    player = {
        "id":        new_id,
        "name":      v[1],
        "position":  v[2],
        "birthYear": int(v[3]),
        "teamId":    int(v[4]),
    }
    save_players([*players, player])
    return maxi_response([player], "P", [T_PLAYER], status=201)


@app.put("/players/<int:player_id>")
def update_player(player_id: int):
    body = request.get_data(as_text=True)
    parsed = asyncio.run(parse_maxi(body, load_schema=load_schema))
    players = load_players()
    idx = next((i for i, p in enumerate(players) if p["id"] == player_id), None)
    if idx is None:
        return maxi_not_found()
    v = parsed.records[0].values
    players[idx] = {
        "id":        player_id,
        "name":      v[1],
        "position":  v[2],
        "birthYear": int(v[3]),
        "teamId":    int(v[4]),
    }
    save_players(players)
    return maxi_response([players[idx]], "P", [T_PLAYER])


@app.delete("/players/<int:player_id>")
def delete_player(player_id: int):
    players = load_players()
    idx = next((i for i, p in enumerate(players) if p["id"] == player_id), None)
    if idx is None:
        return maxi_not_found()
    players.pop(idx)
    save_players(players)
    return ("", 204)


# ---------------------------------------------------------------------------
# Player transfer history
# ---------------------------------------------------------------------------

@app.get("/players/<int:player_id>/transfers")
def get_player_transfers(player_id: int):
    rows = load_transfers_with_refs(player_id)
    if not rows:
        return maxi_not_found()
    return maxi_response(rows, "X", [T_PLAYER, T_TEAM, T_TRANSFER])


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------

@app.get("/teams")
def get_teams():
    return maxi_response(load_teams(), "T", [T_TEAM])


@app.get("/teams/<int:team_id>")
def get_team(team_id: int):
    team = load_team_by_id(team_id)
    if team is None:
        return maxi_not_found()
    roster = [p for p in load_players() if p["teamId"] == team["id"]]
    return maxi_response({"T": [team], "P": roster}, "T", [T_TEAM, T_PLAYER])


# ---------------------------------------------------------------------------
# Games
# ---------------------------------------------------------------------------

@app.get("/games")
def get_games():
    return maxi_response(load_games(), "G", [T_GAME])


@app.get("/games/<int:game_id>")
def get_game(game_id: int):
    game = load_game_by_id(game_id)
    if game is None:
        return maxi_not_found()
    stats = load_game_stats_by_game_id(game_id)
    if stats:
        return maxi_response(
            {"G": [game], "D": [stats]}, "G", [T_GAME, T_STATS, T_GAME_DETAIL]
        )
    return maxi_response([game], "G", [T_GAME])


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------

@app.get("/transfers")
def get_transfers():
    rows = load_transfers_with_refs()
    return maxi_response(rows, "X", [T_PLAYER, T_TEAM, T_TRANSFER])


# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Sports API (MAXI) listening on http://localhost:{PORT}")
    print()
    print("Endpoints:")
    print("  GET  /players")
    print("  GET  /players/<id>")
    print("  POST /players          (Content-Type: application/maxi)")
    print("  PUT  /players/<id>     (Content-Type: application/maxi)")
    print("  GET  /players/<id>/transfers")
    print("  GET  /teams")
    print("  GET  /teams/<id>")
    print("  GET  /games")
    print("  GET  /games/<id>")
    print("  GET  /transfers")
    print()
    app.run(host="0.0.0.0", port=PORT, debug=False)
