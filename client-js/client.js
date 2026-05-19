/**
 * Sports Statistics API — JavaScript CLI Client
 *
 * Demonstrates round-trip MAXI parsing including:
 *  - plain parseMaxi (raw records + values)
 *  - parseMaxiAs (hydrated class instances)
 *  - object reference resolution on /transfers
 *  - POST /players with a MAXI request body
 *  - PUT /players/:id with a MAXI request body
 *
 * Usage:
 *   BASE_URL=http://localhost:8060 node client.js
 */

import { parseMaxi, parseMaxiAs, dumpMaxi } from '@maxi-format/maxi';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8060';
const SHARED   = join(dirname(fileURLToPath(import.meta.url)), '../shared');

const loadSchema = name => readFileSync(join(SHARED, name), 'utf8');

// ---------------------------------------------------------------------------
// Simple class models for hydration demonstration
// ---------------------------------------------------------------------------

class Player {
  constructor({ id, name, position, birthYear, teamId } = {}) {
    this.id        = id;
    this.name      = name;
    this.position  = position;
    this.birthYear = birthYear;
    this.teamId    = teamId;
  }
  toString() { return `Player(${this.id} | ${this.name} | ${this.position} | ${this.birthYear})`; }
}

class Team {
  constructor({ id, name, city, founded, coach } = {}) {
    this.id      = id;
    this.name    = name;
    this.city    = city;
    this.founded = founded;
    this.coach   = coach;
  }
  toString() { return `Team(${this.id} | ${this.name} | ${this.city})`; }
}

class Transfer {
  constructor({ id, player, fromTeam, toTeam, date, fee } = {}) {
    this.id       = id;
    this.player   = player;
    this.fromTeam = fromTeam;
    this.toTeam   = toTeam;
    this.date     = date;
    this.fee      = fee;
  }
  toString() {
    const playerStr   = this.player   instanceof Player ? this.player.name   : `playerId:${this.player}`;
    const fromStr     = this.fromTeam instanceof Team   ? this.fromTeam.name : `teamId:${this.fromTeam}`;
    const toStr       = this.toTeam   instanceof Team   ? this.toTeam.name   : `teamId:${this.toTeam}`;
    const feeStr      = this.fee != null ? `€${Number(this.fee).toLocaleString()}` : 'free';
    return `Transfer(#${this.id} | ${playerStr} | ${fromStr} → ${toStr} | ${this.date} | ${feeStr})`;
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.text();
}

async function post(path, maxi) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/maxi' },
    body: maxi,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.text();
}

async function put(path, maxi) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/maxi' },
    body: maxi,
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`);
  return res.text();
}

async function del(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (res.status !== 204 && !res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
  return res.status;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const HR = '─'.repeat(60);

function section(title) {
  console.log(`\n${HR}`);
  console.log(`  ${title}`);
  console.log(HR);
}

function printRaw(label, text) {
  console.log(`\n[RAW MAXI — ${label}]`);
  console.log(text);
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)));
  const fmt    = row => '  ' + row.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  ');
  console.log(fmt(headers));
  console.log('  ' + widths.map(w => '─'.repeat(w)).join('  '));
  rows.forEach(r => console.log(fmt(r)));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ── 1. GET /players — raw parseMaxi ────────────────────────────────────────
section('GET /players  (raw parseMaxi → positional values)');
{
  const text   = await get('/players');
  const result = await parseMaxi(text, { loadSchema });
  const rows   = result.records.map(r => r.values);
  printTable(['id', 'name', 'position', 'birthYear', 'teamId'], rows);
}

// ── 2. GET /players — parseMaxiAs → hydrated Player instances ──────────────
section('GET /players  (parseMaxiAs → Player class instances)');
{
  const text = await get('/players');
  const { objects } = await parseMaxiAs(text, { P: Player }, { loadSchema });
  objects.P.forEach(p => console.log('  ' + p.toString()));
}

// ── 3. GET /teams ───────────────────────────────────────────────────────────
section('GET /teams');
{
  const text = await get('/teams');
  const { objects } = await parseMaxiAs(text, { T: Team }, { loadSchema });
  objects.T.forEach(t => console.log('  ' + t.toString()));
}

// ── 4. GET /teams/1 — team + roster ────────────────────────────────────────
section('GET /teams/1  (team with roster)');
{
  const text   = await get('/teams/1');
  const result = await parseMaxi(text, { loadSchema });
  const types  = [...result.schema.types.keys()];
  console.log(`  Schema types in response: ${types.join(', ')}`);
  for (const rec of result.records) {
    console.log(`  ${rec.alias}(${rec.values.join(' | ')})`);
  }
}

// ── 5. GET /games ───────────────────────────────────────────────────────────
section('GET /games');
{
  const text   = await get('/games');
  const result = await parseMaxi(text, { loadSchema });
  printTable(
    ['id', 'home', 'away', 'date', 'status', 'score'],
    result.records.map(r => [...r.values.slice(0, 5), `${r.values[5]}–${r.values[6]}`])
  );
}

// ── 6. GET /games/1 — game + nested PlayerStats arrays ─────────────────────
section('GET /games/1  (GameDetail with nested S[] arrays)');
{
  const text   = await get('/games/1');
  printRaw('games/1', text);
  const result = await parseMaxi(text, { loadSchema });
  const detail = result.records.find(r => r.alias === 'D');
  if (detail) {
    const [gameId, homePlayers, awayPlayers] = detail.values;
    console.log(`\n  GameDetail for game ${gameId}:`);
    console.log(`  Home players stats: ${JSON.stringify(homePlayers)}`);
    console.log(`  Away players stats: ${JSON.stringify(awayPlayers)}`);
  }
}

// ── 7. GET /transfers — OBJECT REFERENCE RESOLUTION ────────────────────────
section('GET /transfers  (object references → parseMaxiAs resolves P and T inside X)');
{
  const text     = await get('/transfers');
  printRaw('/transfers', text);

  // parseMaxiAs resolves the P/T id references inside Transfer automatically
  const { objects } = await parseMaxiAs(text, { P: Player, T: Team, X: Transfer }, { loadSchema });

  console.log('\n  Hydrated Transfer objects (player and team are full instances):');
  (objects.X ?? []).forEach(x => console.log('  ' + x.toString()));

  console.log('\n  ✓ player field is a Player instance:', objects.X?.[0]?.player instanceof Player);
  console.log('  ✓ fromTeam field is a Team instance:', objects.X?.[0]?.fromTeam instanceof Team);
}

// ── 8. GET /players/3/transfers — per-player history ──────────────────────
section('GET /players/3/transfers  (Carlos Rivera transfer history)');
{
  const text     = await get('/players/3/transfers');
  const { objects } = await parseMaxiAs(text, { P: Player, T: Team, X: Transfer }, { loadSchema });
  (objects.X ?? []).forEach(x => console.log('  ' + x.toString()));
}

// ── 9. POST /players — send MAXI body, receive MAXI response ───────────────
section('POST /players  (MAXI request body → MAXI response)');
{
  // Build the request body using dumpMaxi so the format is correct
  const newPlayer = { id: 0, name: 'Luca Bianchi', position: 'forward', birthYear: 2001, teamId: 1 };
  const requestBody = dumpMaxi([newPlayer], {
    schemaFile: 'sports.mxs',
    defaultAlias: 'P',
    types: [{ alias: 'P', name: 'Player', fields: [
      { name: 'id', typeExpr: 'int' },
      { name: 'name', constraints: [{ type: 'required' }] },
      { name: 'position', typeExpr: 'enum[forward,midfielder,defender,goalkeeper]' },
      { name: 'birthYear', typeExpr: 'int' },
      { name: 'teamId', typeExpr: 'int' },
    ]}],
  });

  console.log('\n  Request body (MAXI):');
  requestBody.split('\n').forEach(l => console.log('  ' + l));

  const responseText = await post('/players', requestBody);
  const { objects }  = await parseMaxiAs(responseText, { P: Player }, { loadSchema });
  console.log('\n  Created player (from MAXI response):');
  objects.P.forEach(p => console.log('  ' + p.toString()));

  const createdId = objects.P[0].id;

  // ── 10. PUT /players/:id — update the player we just created ─────────────
  section(`PUT /players/${createdId}  (update just-created player via MAXI body)`);
  {
    const updated = { ...newPlayer, id: createdId, position: 'midfielder' };
    const putBody = dumpMaxi([updated], {
      schemaFile:   'sports.mxs',
      defaultAlias: 'P',
      types: [{ alias: 'P', name: 'Player', fields: [
        { name: 'id', typeExpr: 'int' },
        { name: 'name', constraints: [{ type: 'required' }] },
        { name: 'position', typeExpr: 'enum[forward,midfielder,defender,goalkeeper]' },
        { name: 'birthYear', typeExpr: 'int' },
        { name: 'teamId', typeExpr: 'int' },
      ]}],
    });

    const responseText = await put(`/players/${createdId}`, putBody);
    const { objects }  = await parseMaxiAs(responseText, { P: Player }, { loadSchema });
    console.log('\n  Updated player (from MAXI response):');
    objects.P.forEach(p => console.log('  ' + p.toString()));
    console.log(`\n  ✓ position updated to: ${objects.P[0].position}`);
  }

  // ── 10. DELETE /players/:id — clean up the demo player ─────────────────────
  section(`DELETE /players/${createdId}  (clean up demo player)`);
  await del(`/players/${createdId}`);
  console.log('\n  ✓ Demo player removed — data is clean for the next run.');
}

console.log(`\n${HR}`);
console.log('  All endpoints validated successfully.');
console.log(HR + '\n');
