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


def _enrich_player(p: dict, team_map: dict) -> dict:
    """Return a copy of player with 'team' object instead of 'teamId' FK."""
    team = team_map.get(p["teamId"])
    player = {k: v for k, v in p.items() if k != "teamId"}
    player["team"] = team
    return player


def load_players_with_teams():
    team_map = {t["id"]: t for t in _teams}
    return [_enrich_player(p, team_map) for p in _players if team_map.get(p["teamId"])]


def load_player_by_id_with_team(player_id: int):
    team_map = {t["id"]: t for t in _teams}
    p = next((p for p in _players if p["id"] == player_id), None)
    if p is None or not team_map.get(p["teamId"]):
        return None
    return _enrich_player(p, team_map)


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
# Games with team join
# ---------------------------------------------------------------------------

def load_games_with_teams():
    team_map = {t["id"]: t for t in _teams}
    result = []
    for g in _games:
        ht = team_map.get(g["homeTeamId"])
        at = team_map.get(g["awayTeamId"])
        if not ht or not at:
            continue
        game = {k: v for k, v in g.items() if k not in ("homeTeamId", "awayTeamId")}
        game["homeTeam"] = ht
        game["awayTeam"] = at
        result.append(game)
    return result


def load_game_by_id_with_teams(game_id: int):
    team_map = {t["id"]: t for t in _teams}
    for g in _games:
        if g["id"] != game_id:
            continue
        ht = team_map.get(g["homeTeamId"])
        at = team_map.get(g["awayTeamId"])
        if not ht or not at:
            return None
        game = {k: v for k, v in g.items() if k not in ("homeTeamId", "awayTeamId")}
        game["homeTeam"] = ht
        game["awayTeam"] = at
        return game
    return None


def load_game_stats_by_game_id_with_players(game_id: int):
    stats = load_game_stats_by_game_id(game_id)
    if stats is None:
        return None
    player_map = {p["id"]: p for p in load_players_with_teams()}
    def enrich(arr):
        return [
            dict({"player": player_map[s["playerId"]]},
                 **{k: v for k, v in s.items() if k != "playerId"})
            for s in (arr or []) if player_map.get(s["playerId"])
        ]
    return {
        **{k: v for k, v in stats.items() if k not in ("homePlayers", "awayPlayers")},
        "homePlayers": enrich(stats.get("homePlayers", [])),
        "awayPlayers": enrich(stats.get("awayPlayers", [])),
    }


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

    # Keep player.team as an int ID — the full team is already in the pool
    # via fromTeam/toTeam, so the reference pool won't have duplicates.
    def _player_for_transfer(p: dict) -> dict:
        row = {k: v for k, v in p.items() if k != "teamId"}
        row["team"] = p["teamId"]
        return row

    return [
        {
            "id":       t["id"],
            "player":   _player_for_transfer(player_map[t["playerId"]]),
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
