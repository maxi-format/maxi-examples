/**
 * dataLoader.js — in-memory data store for the Sports Statistics API.
 *
 * All JSON files are read ONCE at startup into module-level arrays.
 * POST / PUT / DELETE mutate only these in-memory arrays — the seed files
 * on disk are NEVER written to, so the example always starts clean.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '../shared/data');

function readJson(file) {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
}

// ---------------------------------------------------------------------------
// In-memory state — loaded once at module import time
// ---------------------------------------------------------------------------

let players   = readJson('players.json');
const teams      = readJson('teams.json');
const games      = readJson('games.json');
const gameStats  = readJson('game_stats.json');
const transfers  = readJson('transfers.json');

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export function loadPlayers() {
  return players;
}

export function savePlayers(updated) {
  players = updated;           // update in-memory only
}

export function loadPlayerById(id) {
  return players.find(p => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function loadTeams() {
  return teams;
}

export function loadTeamById(id) {
  return teams.find(t => t.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export function loadGames() {
  return games;
}

export function loadGameById(id) {
  return games.find(g => g.id === id) ?? null;
}

export function loadGameStats() {
  return gameStats;
}

export function loadGameStatsByGameId(gameId) {
  return gameStats.find(s => s.gameId === gameId) ?? null;
}

// ---------------------------------------------------------------------------
// Games with team join
// ---------------------------------------------------------------------------

export function loadGamesWithTeams() {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  return games
    .filter(g => teamMap[g.homeTeamId] && teamMap[g.awayTeamId])
    .map(({ homeTeamId, awayTeamId, ...rest }) => ({
      ...rest, homeTeam: teamMap[homeTeamId], awayTeam: teamMap[awayTeamId],
    }));
}

export function loadGameByIdWithTeams(id) {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const g = games.find(g => g.id === id);
  if (!g || !teamMap[g.homeTeamId] || !teamMap[g.awayTeamId]) return null;
  const { homeTeamId, awayTeamId, ...rest } = g;
  return { ...rest, homeTeam: teamMap[homeTeamId], awayTeam: teamMap[awayTeamId] };
}

export function loadGameStatsByGameIdWithPlayers(gameId) {
  const stats = gameStats.find(s => s.gameId === gameId);
  if (!stats) return null;
  const playerMap = Object.fromEntries(loadPlayersWithTeams().map(p => [p.id, p]));
  const enrich = arr =>
    (arr ?? [])
      .filter(s => playerMap[s.playerId])
      .map(({ playerId, ...rest }) => ({ player: playerMap[playerId], ...rest }));
  return { ...stats, homePlayers: enrich(stats.homePlayers), awayPlayers: enrich(stats.awayPlayers) };
}

// ---------------------------------------------------------------------------
// Transfers — returns rows with nested player/team objects for dumpMaxi
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Players with team join — for GET /players, GET /players/:id
// ---------------------------------------------------------------------------

export function loadPlayersWithTeams() {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  return players
    .filter(p => teamMap[p.teamId])
    .map(({ teamId, ...rest }) => ({ ...rest, team: teamMap[teamId] }));
}

export function loadPlayerByIdWithTeam(id) {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const p = players.find(p => p.id === id);
  if (!p || !teamMap[p.teamId]) return null;
  const { teamId, ...rest } = p;
  return { ...rest, team: teamMap[teamId] };
}

// ---------------------------------------------------------------------------

/**
 * Returns transfers with nested player + team objects ready for dumpMaxi
 * with collectReferences:true.
 *
 * @param {number} [filterPlayerId]  If provided, only return transfers for that player.
 */
export function loadTransfersWithRefs(filterPlayerId) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap   = Object.fromEntries(teams.map(t => [t.id, t]));

  const filtered = filterPlayerId != null
    ? transfers.filter(t => t.playerId === filterPlayerId)
    : transfers;

  // Keep player.team as an int ID — the full team is already in the pool
  // via fromTeam/toTeam, so the reference pool won't have duplicates.
  const enrichPlayer = p => {
    const { teamId, ...rest } = p;
    return { ...rest, team: teamId ?? null };
  };

  return filtered
    .filter(t => playerMap[t.playerId] && teamMap[t.fromTeamId] && teamMap[t.toTeamId])
    .map(t => ({
      id:       t.id,
      player:   enrichPlayer(playerMap[t.playerId]),
      fromTeam: teamMap[t.fromTeamId],
      toTeam:   teamMap[t.toTeamId],
      date:     t.date,
      fee:      t.fee ?? null,
    }));
}
