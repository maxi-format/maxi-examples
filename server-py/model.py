"""
model.py — MAXI model types for the Sports Statistics API server.

These mirror the types defined in shared/sports.mxs. The server uses the
__maxi_schema__ descriptors derived from these classes as type definitions
for dump_maxi(), replacing hand-written dicts.
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
    id      = IntField(id=True)
    name    = StrField(required=True)
    city    = StrField(required=True)
    founded = IntField()
    coach   = StrField(required=True)


class Player(MaxiModel, alias="P", name="Player"):
    id        = IntField(id=True)
    name      = StrField(required=True)
    position  = EnumField(["forward", "midfielder", "defender", "goalkeeper"])
    birthYear = IntField()
    team      = RefField(Team)


class PlayerStats(MaxiModel, alias="S", name="PlayerStats"):
    player        = RefField(Player)
    goals         = IntField(default=0)
    assists       = IntField(default=0)
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
