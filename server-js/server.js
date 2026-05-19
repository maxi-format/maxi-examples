import express from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dumpMaxi, parseMaxi } from '@maxi-format/maxi';
import {
  loadPlayers, savePlayers, loadPlayerById,
  loadTeams, loadTeamById,
  loadGames, loadGameById, loadGameStatsByGameId,
  loadTransfersWithRefs,
} from './dataLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED    = join(__dirname, '../shared');
const PORT      = process.env.PORT ?? 4000;

// ---------------------------------------------------------------------------
// Schema loader — used by parseMaxi for incoming MAXI request bodies
// ---------------------------------------------------------------------------
const loadSchema = name => readFileSync(join(SHARED, name), 'utf8');

// ---------------------------------------------------------------------------
// Type definitions (mirror sports.mxs — used by dumpMaxi)
// these are only needed for the dump side; the @schema directive tells the
// client where to find the full schema.
// ---------------------------------------------------------------------------

const T_PLAYER = {
  alias: 'P', name: 'Player',
  fields: [
    { name: 'id',        typeExpr: 'int' },
    { name: 'name',      constraints: [{ type: 'required' }] },
    { name: 'position',  typeExpr: 'enum[forward,midfielder,defender,goalkeeper]' },
    { name: 'birthYear', typeExpr: 'int' },
    { name: 'teamId',    typeExpr: 'int' },
  ],
};

const T_TEAM = {
  alias: 'T', name: 'Team',
  fields: [
    { name: 'id',      typeExpr: 'int' },
    { name: 'name',    constraints: [{ type: 'required' }] },
    { name: 'city',    constraints: [{ type: 'required' }] },
    { name: 'founded', typeExpr: 'int' },
    { name: 'coach',   constraints: [{ type: 'required' }] },
  ],
};

const T_STATS = {
  alias: 'S', name: 'PlayerStats',
  fields: [
    { name: 'playerId',      typeExpr: 'int' },
    { name: 'goals',         typeExpr: 'int', defaultValue: 0 },
    { name: 'assists',       typeExpr: 'int', defaultValue: 0 },
    { name: 'minutesPlayed', typeExpr: 'int', defaultValue: 0 },
  ],
};

const T_GAME = {
  alias: 'G', name: 'Game',
  fields: [
    { name: 'id',         typeExpr: 'int' },
    { name: 'homeTeamId', typeExpr: 'int' },
    { name: 'awayTeamId', typeExpr: 'int' },
    { name: 'date',       annotation: 'date', constraints: [{ type: 'required' }] },
    { name: 'status',     typeExpr: 'enum[scheduled,live,finished,cancelled]' },
    { name: 'homeScore',  typeExpr: 'int', defaultValue: 0 },
    { name: 'awayScore',  typeExpr: 'int', defaultValue: 0 },
  ],
};

const T_GAME_DETAIL = {
  alias: 'D', name: 'GameDetail',
  fields: [
    { name: 'gameId',      typeExpr: 'int' },
    { name: 'homePlayers', typeExpr: 'S[]' },
    { name: 'awayPlayers', typeExpr: 'S[]' },
  ],
};

const T_TRANSFER = {
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
  maxiResponse(res, loadPlayers(), 'P', [T_PLAYER]);
});

app.get('/players/:id', (req, res) => {
  const player = loadPlayerById(+req.params.id);
  if (!player) return res.status(404).set('Content-Type', 'application/maxi').send('');
  maxiResponse(res, [player], 'P', [T_PLAYER]);
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
  maxiResponse(res, [player], 'P', [T_PLAYER], 201);
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
  maxiResponse(res, [players[idx]], 'P', [T_PLAYER]);
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
  const roster = loadPlayers().filter(p => p.teamId === team.id);
  maxiResponse(res, { T: [team], P: roster }, 'T', [T_TEAM, T_PLAYER]);
});

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

app.get('/games', (req, res) => {
  maxiResponse(res, loadGames(), 'G', [T_GAME]);
});

app.get('/games/:id', (req, res) => {
  const id   = +req.params.id;
  const game = loadGameById(id);
  if (!game) return res.status(404).set('Content-Type', 'application/maxi').send('');
  const stats = loadGameStatsByGameId(id);
  if (stats) {
    maxiResponse(res, { G: [game], D: [stats] }, 'G', [T_GAME, T_STATS, T_GAME_DETAIL]);
  } else {
    maxiResponse(res, [game], 'G', [T_GAME]);
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

