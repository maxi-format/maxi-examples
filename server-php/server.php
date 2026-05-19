<?php

declare(strict_types=1);

/**
 * server.php — Sports Statistics API (PHP)
 * Wire format: application/maxi  (https://github.com/maxi-format/maxi-php)
 *
 * Mirrors the endpoints of ../server-js/server.js and ../server-py/server.py.
 *
 * Usage:
 *   php -S 0.0.0.0:8080 server.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\DataLoader;
use Maxi\Maxi;

$SHARED   = realpath(__DIR__ . '/../shared');
$DATA_DIR = $SHARED . '/data';
$PORT     = (int)($_SERVER['SERVER_PORT'] ?? getenv('PORT') ?: 8080);

$loader = new DataLoader($DATA_DIR);

// ---------------------------------------------------------------------------
// Type definitions (mirror sports.mxs — used by Maxi::dump)
// ---------------------------------------------------------------------------

$T_PLAYER = [
    'alias' => 'P', 'name' => 'Player',
    'fields' => [
        ['name' => 'id',        'typeExpr' => 'int'],
        ['name' => 'name',      'constraints' => [['type' => 'required']]],
        ['name' => 'position',  'typeExpr' => 'enum[forward,midfielder,defender,goalkeeper]'],
        ['name' => 'birthYear', 'typeExpr' => 'int'],
        ['name' => 'teamId',    'typeExpr' => 'int'],
    ],
];

$T_TEAM = [
    'alias' => 'T', 'name' => 'Team',
    'fields' => [
        ['name' => 'id',      'typeExpr' => 'int'],
        ['name' => 'name',    'constraints' => [['type' => 'required']]],
        ['name' => 'city',    'constraints' => [['type' => 'required']]],
        ['name' => 'founded', 'typeExpr' => 'int'],
        ['name' => 'coach',   'constraints' => [['type' => 'required']]],
    ],
];

$T_STATS = [
    'alias' => 'S', 'name' => 'PlayerStats',
    'fields' => [
        ['name' => 'playerId',      'typeExpr' => 'int'],
        ['name' => 'goals',         'typeExpr' => 'int', 'defaultValue' => 0],
        ['name' => 'assists',       'typeExpr' => 'int', 'defaultValue' => 0],
        ['name' => 'minutesPlayed', 'typeExpr' => 'int', 'defaultValue' => 0],
    ],
];

$T_GAME = [
    'alias' => 'G', 'name' => 'Game',
    'fields' => [
        ['name' => 'id',         'typeExpr' => 'int'],
        ['name' => 'homeTeamId', 'typeExpr' => 'int'],
        ['name' => 'awayTeamId', 'typeExpr' => 'int'],
        ['name' => 'date',       'annotation' => 'date', 'constraints' => [['type' => 'required']]],
        ['name' => 'status',     'typeExpr' => 'enum[scheduled,live,finished,cancelled]'],
        ['name' => 'homeScore',  'typeExpr' => 'int', 'defaultValue' => 0],
        ['name' => 'awayScore',  'typeExpr' => 'int', 'defaultValue' => 0],
    ],
];

$T_GAME_DETAIL = [
    'alias' => 'D', 'name' => 'GameDetail',
    'fields' => [
        ['name' => 'gameId',      'typeExpr' => 'int'],
        ['name' => 'homePlayers', 'typeExpr' => 'S[]'],
        ['name' => 'awayPlayers', 'typeExpr' => 'S[]'],
    ],
];

$T_TRANSFER = [
    'alias' => 'X', 'name' => 'Transfer',
    'fields' => [
        ['name' => 'id',       'typeExpr' => 'int'],
        ['name' => 'player',   'typeExpr' => 'P'],
        ['name' => 'fromTeam', 'typeExpr' => 'T'],
        ['name' => 'toTeam',   'typeExpr' => 'T'],
        ['name' => 'date',     'annotation' => 'date', 'constraints' => [['type' => 'required']]],
        ['name' => 'fee',      'typeExpr' => 'decimal'],
    ],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSchema(string $name): string
{
    global $SHARED;
    $safe = preg_replace('/[^a-zA-Z0-9._-]/', '', $name);
    return file_get_contents($SHARED . '/' . $safe);
}

function maxiResponse(mixed $data, string $alias, array $types, int $status = 200): void
{
    $body = Maxi::dump($data, [
        'schemaFile'        => 'sports.mxs',
        'defaultAlias'      => $alias,
        'types'             => $types,
        'includeTypes'      => false,
        'collectReferences' => true,
    ]);
    http_response_code($status);
    header('Content-Type: application/maxi');
    echo $body;
}

function notFound(): void
{
    http_response_code(404);
    header('Content-Type: application/maxi');
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'];
$uri    = strtok($_SERVER['REQUEST_URI'], '?');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

// GET /schema/:name
if ($method === 'GET' && preg_match('#^/schema/([a-zA-Z0-9._-]+)$#', $uri, $m)) {
    $path = $SHARED . '/' . $m[1];
    if (!file_exists($path)) {
        http_response_code(404);
        echo 'Schema not found';
        exit;
    }
    header('Content-Type: text/plain; charset=utf-8');
    echo file_get_contents($path);
    exit;
}

// GET /players
if ($method === 'GET' && $uri === '/players') {
    global $T_PLAYER;
    maxiResponse($loader->loadPlayers(), 'P', [$T_PLAYER]);
    exit;
}

// GET /players/:id
if ($method === 'GET' && preg_match('#^/players/(\d+)$#', $uri, $m)) {
    global $T_PLAYER;
    $player = $loader->loadPlayerById((int)$m[1]);
    if ($player === null) { notFound(); exit; }
    maxiResponse([$player], 'P', [$T_PLAYER]);
    exit;
}

// POST /players
if ($method === 'POST' && $uri === '/players') {
    global $T_PLAYER;
    $body    = file_get_contents('php://input');
    $parsed  = Maxi::parse($body, ['loadSchema' => 'loadSchema']);
    $players = $loader->loadPlayers();
    $maxId   = array_reduce($players, fn($carry, $p) => max($carry, $p['id']), 0);
    $v       = $parsed->records[0]->values;
    $player  = [
        'id'        => $maxId + 1,
        'name'      => $v[1],
        'position'  => $v[2],
        'birthYear' => (int)$v[3],
        'teamId'    => (int)$v[4],
    ];
    $loader->savePlayers([...$players, $player]);
    maxiResponse([$player], 'P', [$T_PLAYER], 201);
    exit;
}

// PUT /players/:id
if ($method === 'PUT' && preg_match('#^/players/(\d+)$#', $uri, $m)) {
    global $T_PLAYER;
    $id      = (int)$m[1];
    $body    = file_get_contents('php://input');
    $parsed  = Maxi::parse($body, ['loadSchema' => 'loadSchema']);
    $players = $loader->loadPlayers();
    $idx     = null;
    foreach ($players as $i => $p) {
        if ($p['id'] === $id) { $idx = $i; break; }
    }
    if ($idx === null) { notFound(); exit; }
    $v = $parsed->records[0]->values;
    $players[$idx] = [
        'id'        => $id,
        'name'      => $v[1],
        'position'  => $v[2],
        'birthYear' => (int)$v[3],
        'teamId'    => (int)$v[4],
    ];
    $loader->savePlayers($players);
    maxiResponse([$players[$idx]], 'P', [$T_PLAYER]);
    exit;
}

// DELETE /players/:id
if ($method === 'DELETE' && preg_match('#^/players/(\d+)$#', $uri, $m)) {
    $id      = (int)$m[1];
    $players = $loader->loadPlayers();
    $idx     = null;
    foreach ($players as $i => $p) {
        if ($p['id'] === $id) { $idx = $i; break; }
    }
    if ($idx === null) { notFound(); exit; }
    array_splice($players, $idx, 1);
    $loader->savePlayers($players);
    http_response_code(204);
    exit;
}

// GET /players/:id/transfers
if ($method === 'GET' && preg_match('#^/players/(\d+)/transfers$#', $uri, $m)) {
    global $T_PLAYER, $T_TEAM, $T_TRANSFER;
    $rows = $loader->loadTransfersWithRefs((int)$m[1]);
    if (empty($rows)) { notFound(); exit; }
    maxiResponse($rows, 'X', [$T_PLAYER, $T_TEAM, $T_TRANSFER]);
    exit;
}

// GET /teams
if ($method === 'GET' && $uri === '/teams') {
    global $T_TEAM;
    maxiResponse($loader->loadTeams(), 'T', [$T_TEAM]);
    exit;
}

// GET /teams/:id
if ($method === 'GET' && preg_match('#^/teams/(\d+)$#', $uri, $m)) {
    global $T_TEAM, $T_PLAYER;
    $team = $loader->loadTeamById((int)$m[1]);
    if ($team === null) { notFound(); exit; }
    $roster = array_values(array_filter($loader->loadPlayers(), fn($p) => $p['teamId'] === $team['id']));
    maxiResponse(['T' => [$team], 'P' => $roster], 'T', [$T_TEAM, $T_PLAYER]);
    exit;
}

// GET /games
if ($method === 'GET' && $uri === '/games') {
    global $T_GAME;
    maxiResponse($loader->loadGames(), 'G', [$T_GAME]);
    exit;
}

// GET /games/:id
if ($method === 'GET' && preg_match('#^/games/(\d+)$#', $uri, $m)) {
    global $T_GAME, $T_STATS, $T_GAME_DETAIL;
    $game = $loader->loadGameById((int)$m[1]);
    if ($game === null) { notFound(); exit; }
    $stats = $loader->loadGameStatsByGameId((int)$m[1]);
    if ($stats !== null) {
        maxiResponse(['G' => [$game], 'D' => [$stats]], 'G', [$T_GAME, $T_STATS, $T_GAME_DETAIL]);
    } else {
        maxiResponse([$game], 'G', [$T_GAME]);
    }
    exit;
}

// GET /transfers
if ($method === 'GET' && $uri === '/transfers') {
    global $T_PLAYER, $T_TEAM, $T_TRANSFER;
    $rows = $loader->loadTransfersWithRefs();
    maxiResponse($rows, 'X', [$T_PLAYER, $T_TEAM, $T_TRANSFER]);
    exit;
}

// 404
http_response_code(404);
header('Content-Type: text/plain');
echo 'Not Found';
