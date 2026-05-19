"""
data_loader.py — in-memory data store for the Sports Statistics API.

All JSON files are read ONCE at module import time into module-level lists.
POST / PUT / DELETE mutate only these in-memory lists — the seed files on
disk are NEVER written to, so the example always starts clean on restart.
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "shared" / "data"


def _read(filename: str):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# In-memory state — loaded once at import time
# ---------------------------------------------------------------------------

_players   = _read("players.json")
_teams     = _read("teams.json")
_games     = _read("games.json")
_stats     = _read("game_stats.json")
_transfers = _read("transfers.json")


# ---------------------------------------------------------------------------
# Players
# ---------------------------------------------------------------------------

def load_players():
    return _players


def save_players(updated: list) -> None:
    global _players
    _players = updated          # update in-memory only — never touches disk


def load_player_by_id(player_id: int):
    return next((p for p in _players if p["id"] == player_id), None)


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------

def load_teams():
    return _teams


def load_team_by_id(team_id: int):
    return next((t for t in _teams if t["id"] == team_id), None)


# ---------------------------------------------------------------------------
# Games
# ---------------------------------------------------------------------------

def load_games():
    return _games


def load_game_by_id(game_id: int):
    return next((g for g in _games if g["id"] == game_id), None)


def load_game_stats():
    return _stats


def load_game_stats_by_game_id(game_id: int):
    return next((s for s in _stats if s["gameId"] == game_id), None)


# ---------------------------------------------------------------------------
# Transfers — returns rows with nested player/team dicts for dump_maxi
# ---------------------------------------------------------------------------

def load_transfers_with_refs(filter_player_id: int | None = None):
    player_map = {p["id"]: p for p in _players}
    team_map   = {t["id"]: t for t in _teams}

    rows = (
        [t for t in _transfers if t["playerId"] == filter_player_id]
        if filter_player_id is not None
        else _transfers
    )

    return [
        {
            "id":       t["id"],
            "player":   player_map[t["playerId"]],
            "fromTeam": team_map[t["fromTeamId"]],
            "toTeam":   team_map[t["toTeamId"]],
            "date":     t["date"],
            "fee":      t.get("fee"),
        }
        for t in rows
        if t["playerId"] in player_map
        and t["fromTeamId"] in team_map
        and t["toTeamId"] in team_map
    ]
