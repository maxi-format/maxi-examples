"""
model.py — MAXI model types for the Sports Statistics API client.

These mirror the types defined in shared/sports.mxs and can be used with
parse_maxi_as() for typed record hydration.

Usage:
    from model import Team, Player, Transfer, PlayerStats, Game, GameDetail
    from maxi import parse_maxi_as

    result = await parse_maxi_as(text, {"T": Team, "P": Player}, load_schema=load_schema)
"""

from maxi.models import (
    ArrayField,
    DecimalField,
    EnumField,
    IntField,
    MaxiModel,
    RefField,
    StrField,
)


class Team(MaxiModel, alias="T", name="Team"):
    id        = IntField(id=True)
    name      = StrField(required=True)
    city      = StrField(required=True)
    founded   = IntField()
    coach     = StrField(required=True)


class Player(MaxiModel, alias="P", name="Player"):
    id        = IntField(id=True)
    name      = StrField(required=True)
    position  = EnumField(["forward", "midfielder", "defender", "goalkeeper"])
    birthYear = IntField()
    team      = RefField(Team)


class PlayerStats(MaxiModel, alias="S", name="PlayerStats"):
    player       = RefField(Player)
    goals        = IntField(default=0)
    assists      = IntField(default=0)
    minutesPlayed = IntField(default=0)


class Game(MaxiModel, alias="G", name="Game"):
    id        = IntField(id=True)
    homeTeam  = RefField(Team)
    awayTeam  = RefField(Team)
    date      = StrField(annotation="date", required=True)
    status    = EnumField(["scheduled", "live", "finished", "cancelled"])
    homeScore = IntField(default=0)
    awayScore = IntField(default=0)


class GameDetail(MaxiModel, alias="D", name="GameDetail"):
    gameId      = IntField()
    homePlayers = ArrayField("S")
    awayPlayers = ArrayField("S")


class Transfer(MaxiModel, alias="X", name="Transfer"):
    id       = IntField(id=True)
    player   = RefField(Player)
    fromTeam = RefField(Team)
    toTeam   = RefField(Team)
    date     = StrField(annotation="date", required=True)
    fee      = DecimalField()
