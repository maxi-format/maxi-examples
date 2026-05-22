/**
 * model.js — MAXI model types for the Sports Statistics API server.
 *
 * Each class has a `static maxiSchema` property that mirrors the type
 * definition from shared/sports.mxs. The server uses `getMaxiSchema(Class)`
 * to get type descriptors for dumpMaxi(), replacing hand-written objects.
 */

export class Team {
  static maxiSchema = {
    alias: 'T', name: 'Team',
    fields: [
      { name: 'id',      typeExpr: 'int' },
      { name: 'name',    constraints: [{ type: 'required' }] },
      { name: 'city',    constraints: [{ type: 'required' }] },
      { name: 'founded', typeExpr: 'int' },
      { name: 'coach',   constraints: [{ type: 'required' }] },
    ],
  };
}

export class Player {
  static maxiSchema = {
    alias: 'P', name: 'Player',
    fields: [
      { name: 'id',        typeExpr: 'int' },
      { name: 'name',      constraints: [{ type: 'required' }] },
      { name: 'position',  typeExpr: 'enum[forward,midfielder,defender,goalkeeper]' },
      { name: 'birthYear', typeExpr: 'int' },
      { name: 'team',      typeExpr: 'T' },
    ],
  };
}

export class PlayerStats {
  static maxiSchema = {
    alias: 'S', name: 'PlayerStats',
    fields: [
      { name: 'player',        typeExpr: 'P' },
      { name: 'goals',         typeExpr: 'int', defaultValue: 0 },
      { name: 'assists',       typeExpr: 'int', defaultValue: 0 },
      { name: 'minutesPlayed', typeExpr: 'int', defaultValue: 0 },
    ],
  };
}

export class Game {
  static maxiSchema = {
    alias: 'G', name: 'Game',
    fields: [
      { name: 'id',        typeExpr: 'int' },
      { name: 'homeTeam',  typeExpr: 'T' },
      { name: 'awayTeam',  typeExpr: 'T' },
      { name: 'date',      annotation: 'date', constraints: [{ type: 'required' }] },
      { name: 'status',    typeExpr: 'enum[scheduled,live,finished,cancelled]' },
      { name: 'homeScore', typeExpr: 'int', defaultValue: 0 },
      { name: 'awayScore', typeExpr: 'int', defaultValue: 0 },
    ],
  };
}

export class GameDetail {
  static maxiSchema = {
    alias: 'D', name: 'GameDetail',
    fields: [
      { name: 'gameId',      typeExpr: 'int' },
      { name: 'homePlayers', typeExpr: 'S[]' },
      { name: 'awayPlayers', typeExpr: 'S[]' },
    ],
  };
}

export class Transfer {
  static maxiSchema = {
    alias: 'X', name: 'Transfer',
    fields: [
      { name: 'id',       typeExpr: 'int' },
      { name: 'player',   typeExpr: 'P' },
      { name: 'fromTeam', typeExpr: 'T' },
      { name: 'toTeam',   typeExpr: 'T' },
      { name: 'date',     annotation: 'date', constraints: [{ type: 'required' }] },
      { name: 'fee',      typeExpr: 'decimal' },
    ],
  };
}
