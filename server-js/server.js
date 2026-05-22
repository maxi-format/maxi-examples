import express from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dumpMaxi, parseMaxi, getMaxiSchema } from '@maxi-format/maxi';
import {
  loadPlayers, savePlayers,
  loadPlayersWithTeams, loadPlayerByIdWithTeam,
  loadTeams, loadTeamById,
  loadGames, loadGameById, loadGameStatsByGameId,
  loadGamesWithTeams, loadGameByIdWithTeams, loadGameStatsByGameIdWithPlayers,
  loadTransfersWithRefs,
} from './dataLoader.js';
import { Team, Player, PlayerStats, Game, GameDetail, Transfer } from './model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED    = join(__dirname, '../shared');
const PORT      = process.env.PORT ?? 4000;

// ---------------------------------------------------------------------------
// Schema loader — used by parseMaxi for incoming MAXI request bodies
// ---------------------------------------------------------------------------
const loadSchema = name => readFileSync(join(SHARED, name), 'utf8');

// ---------------------------------------------------------------------------
// Type definitions — derived from annotated model classes in model.js
// ---------------------------------------------------------------------------

const T_PLAYER      = getMaxiSchema(Player);
const T_TEAM        = getMaxiSchema(Team);
const T_STATS       = getMaxiSchema(PlayerStats);
const T_GAME        = getMaxiSchema(Game);
const T_GAME_DETAIL = getMaxiSchema(GameDetail);
const T_TRANSFER    = getMaxiSchema(Transfer);

// ---------------------------------------------------------------------------
// Helper: build a MAXI response
// ---------------------------------------------------------------------------

function maxiResponse(res, data, alias, types, statusCode = 200) {
  const body = dumpMaxi(data, {
    schemaFile:        'sports.mxs',
    defaultAlias:      alias,
    types,
    includeTypes:      false,
    collectReferences: true,
  });
  res.status(statusCode).set('Content-Type', 'application/maxi').send(body);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();

// CORS — allow browser clients served from any origin (e.g. file:// or a dev server)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin',  '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parse MAXI request bodies
app.use(express.text({ type: 'application/maxi' }));

// ---------------------------------------------------------------------------
// Static file serving — browser client
// ---------------------------------------------------------------------------

// Serve the browser client at /browser-client/
app.use('/browser-client', express.static(join(__dirname, '../client-js/browser-client')));


// ---------------------------------------------------------------------------
// Schema file endpoint — lets browser clients fetch sports.mxs without CORS issues
// ---------------------------------------------------------------------------

app.get('/schema/:name', (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9._-]/g, ''); // sanitise
  try {
    const content = readFileSync(join(SHARED, name), 'utf8');
    res.set('Content-Type', 'text/plain; charset=utf-8').send(content);
  } catch {
    res.status(404).send('Schema not found');
  }
});

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

app.get('/players', (req, res) => {
  maxiResponse(res, loadPlayersWithTeams(), 'P', [T_PLAYER, T_TEAM]);
});

app.get('/players/:id', (req, res) => {
  const player = loadPlayerByIdWithTeam(+req.params.id);
  if (!player) return res.status(404).set('Content-Type', 'application/maxi').send('');
  maxiResponse(res, [player], 'P', [T_PLAYER, T_TEAM]);
});

app.post('/players', async (req, res) => {
  const parsed  = await parseMaxi(req.body, { loadSchema });
  const players = loadPlayers();
  const newId   = Math.max(0, ...players.map(p => p.id)) + 1;
  // records[0].values is positional: [id, name, position, birthYear, teamId]
  // The client may send any id — we always assign server-side
  const v = parsed.records[0].values;
  const player = {
    id:        newId,
    name:      v[1],
    position:  v[2],
    birthYear: Number(v[3]),
    teamId:    Number(v[4]),
  };
  savePlayers([...players, player]);
  maxiResponse(res, [loadPlayerByIdWithTeam(newId)], 'P', [T_PLAYER, T_TEAM], 201);
});

app.put('/players/:id', async (req, res) => {
  const id      = +req.params.id;
  const parsed  = await parseMaxi(req.body, { loadSchema });
  const players = loadPlayers();
  const idx     = players.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).set('Content-Type', 'application/maxi').send('');
  const v = parsed.records[0].values;
  players[idx] = {
    id,
    name:      v[1],
    position:  v[2],
    birthYear: Number(v[3]),
    teamId:    Number(v[4]),
  };
  savePlayers(players);
  maxiResponse(res, [loadPlayerByIdWithTeam(id)], 'P', [T_PLAYER, T_TEAM]);
});

app.delete('/players/:id', (req, res) => {
  const id      = +req.params.id;
  const players = loadPlayers();
  const idx     = players.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).set('Content-Type', 'application/maxi').send('');
  players.splice(idx, 1);
  savePlayers(players);
  res.status(204).send('');
});

// ---------------------------------------------------------------------------
// Player transfer history
// ---------------------------------------------------------------------------

app.get('/players/:id/transfers', (req, res) => {
  const rows = loadTransfersWithRefs(+req.params.id);
  if (!rows.length) return res.status(404).set('Content-Type', 'application/maxi').send('');
  maxiResponse(res, rows, 'X', [T_PLAYER, T_TEAM, T_TRANSFER]);
});

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

app.get('/teams', (req, res) => {
  maxiResponse(res, loadTeams(), 'T', [T_TEAM]);
});

app.get('/teams/:id', (req, res) => {
  const team = loadTeamById(+req.params.id);
  if (!team) return res.status(404).set('Content-Type', 'application/maxi').send('');
  // Include roster: players belonging to this team
  const roster = loadPlayersWithTeams().filter(p => p.team?.id === team.id);
  maxiResponse(res, { T: [team], P: roster }, 'T', [T_TEAM, T_PLAYER]);
});

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

app.get('/games', (req, res) => {
  maxiResponse(res, loadGamesWithTeams(), 'G', [T_GAME, T_TEAM]);
});

app.get('/games/:id', (req, res) => {
  const id   = +req.params.id;
  const game = loadGameByIdWithTeams(id);
  if (!game) return res.status(404).set('Content-Type', 'application/maxi').send('');
  const stats = loadGameStatsByGameIdWithPlayers(id);
  if (stats) {
    const players = [...stats.homePlayers, ...stats.awayPlayers].map(s => s.player);
    maxiResponse(res, { G: [game], D: [stats], P: players }, 'G', [T_GAME, T_TEAM, T_STATS, T_PLAYER, T_GAME_DETAIL]);
  } else {
    maxiResponse(res, [game], 'G', [T_GAME, T_TEAM]);
  }
});

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

app.get('/transfers', (req, res) => {
  const rows = loadTransfersWithRefs();
  maxiResponse(res, rows, 'X', [T_PLAYER, T_TEAM, T_TRANSFER]);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Sports API (MAXI) listening on http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /players');
  console.log('  GET  /players/:id');
  console.log('  POST /players          (Content-Type: application/maxi)');
  console.log('  PUT  /players/:id      (Content-Type: application/maxi)');
  console.log('  GET  /players/:id/transfers');
  console.log('  GET  /teams');
  console.log('  GET  /teams/:id');
  console.log('  GET  /games');
  console.log('  GET  /games/:id');
  console.log('  GET  /transfers');
  console.log('');
  console.log(`Browser client → http://localhost:${PORT}/browser-client/`);
});

