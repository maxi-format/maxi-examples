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
use App\Model\Game;
use App\Model\GameDetail;
use App\Model\Player;
use App\Model\PlayerStats;
use App\Model\Team;
use App\Model\Transfer;
use Maxi\Maxi;
use Maxi\Registry\MaxiSchemaRegistry;

$SHARED   = realpath(__DIR__ . '/../shared');
$DATA_DIR = $SHARED . '/data';
$PORT     = (int)($_SERVER['SERVER_PORT'] ?? getenv('PORT') ?: 8080);

$loader = new DataLoader($DATA_DIR);
$maxi   = new Maxi();

function loadSchema(string $name): string
{
    global $SHARED;
    $safe = preg_replace('/[^a-zA-Z0-9._-]/', '', $name);
    return file_get_contents($SHARED . '/' . $safe);
}

/**
 * Serialise $data to MAXI and send the HTTP response.
 *
 * @param mixed              $data        Rows or alias-keyed map (passed to Maxi::dump).
 * @param string             $alias       Default record alias.
 * @param class-string[]     $typeClasses Model class names; their MAXI schemas are
 *                                        resolved via MaxiSchemaRegistry::get().
 * @param int                $status      HTTP status code.
 */
function maxiResponse(mixed $data, string $alias, array $typeClasses, int $status = 200): void
{
    global $maxi;
    $types = array_map(fn($c) => MaxiSchemaRegistry::get($c), $typeClasses);
    $body  = $maxi->dump($data, [
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
    maxiResponse($loader->loadPlayersWithTeams(), 'P', [Player::class, Team::class]);
    exit;
}

// GET /players/:id
if ($method === 'GET' && preg_match('#^/players/(\d+)$#', $uri, $m)) {
    $player = $loader->loadPlayerByIdWithTeam((int)$m[1]);
    if ($player === null) { notFound(); exit; }
    maxiResponse([$player], 'P', [Player::class, Team::class]);
    exit;
}

// POST /players
if ($method === 'POST' && $uri === '/players') {
    $body    = file_get_contents('php://input');
    $parsed  = $maxi->parse($body, ['loadSchema' => 'loadSchema']);
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
    maxiResponse([$loader->loadPlayerByIdWithTeam($maxId + 1)], 'P', [Player::class, Team::class], 201);
    exit;
}

// PUT /players/:id
if ($method === 'PUT' && preg_match('#^/players/(\d+)$#', $uri, $m)) {
    $id      = (int)$m[1];
    $body    = file_get_contents('php://input');
    $parsed  = $maxi->parse($body, ['loadSchema' => 'loadSchema']);
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
    maxiResponse([$loader->loadPlayerByIdWithTeam($id)], 'P', [Player::class, Team::class]);
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
    $rows = $loader->loadTransfersWithRefs((int)$m[1]);
    if (empty($rows)) { notFound(); exit; }
    maxiResponse($rows, 'X', [Player::class, Team::class, Transfer::class]);
    exit;
}

// GET /teams
if ($method === 'GET' && $uri === '/teams') {
    maxiResponse($loader->loadTeams(), 'T', [Team::class]);
    exit;
}

// GET /teams/:id
if ($method === 'GET' && preg_match('#^/teams/(\d+)$#', $uri, $m)) {
    $team = $loader->loadTeamById((int)$m[1]);
    if ($team === null) { notFound(); exit; }
    $roster = array_values(array_filter($loader->loadPlayersWithTeams(), fn($p) => ($p['team']['id'] ?? null) === $team['id']));
    maxiResponse(['T' => [$team], 'P' => $roster], 'T', [Team::class, Player::class]);
    exit;
}

// GET /games
if ($method === 'GET' && $uri === '/games') {
    maxiResponse($loader->loadGamesWithTeams(), 'G', [Game::class, Team::class]);
    exit;
}

// GET /games/:id
if ($method === 'GET' && preg_match('#^/games/(\d+)$#', $uri, $m)) {
    $game = $loader->loadGameByIdWithTeams((int)$m[1]);
    if ($game === null) { notFound(); exit; }
    $stats = $loader->loadGameStatsByGameIdWithPlayers((int)$m[1]);
    if ($stats !== null) {
        $players = array_values(array_map(
            fn($s) => $s['player'],
            array_merge($stats['homePlayers'] ?? [], $stats['awayPlayers'] ?? [])
        ));
        maxiResponse(['G' => [$game], 'D' => [$stats], 'P' => $players], 'G',
            [Game::class, Team::class, PlayerStats::class, Player::class, GameDetail::class]);
    } else {
        maxiResponse([$game], 'G', [Game::class, Team::class]);
    }
    exit;
}

// GET /transfers
if ($method === 'GET' && $uri === '/transfers') {
    $rows = $loader->loadTransfersWithRefs();
    maxiResponse($rows, 'X', [Player::class, Team::class, Transfer::class]);
    exit;
}

// 404
http_response_code(404);
header('Content-Type: text/plain');
echo 'Not Found';
