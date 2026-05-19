#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * client.php — Sports Statistics API CLI Client (PHP)
 *
 * Every request/response MAXI body is printed inline so you can see exactly
 * what wire format is exchanged.
 *
 * Usage:
 *   BASE_URL=http://localhost:8060 php client.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use Maxi\Maxi;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

$BASE_URL = rtrim(getenv('BASE_URL') ?: 'http://localhost:8060', '/');
$SHARED   = realpath(__DIR__ . '/../shared');

$loadSchema = fn(string $name) => file_get_contents(
    $SHARED . '/' . preg_replace('/[^a-zA-Z0-9._-]/', '', $name)
);

// ---------------------------------------------------------------------------
// HTTP helpers — always print method, URL, status and raw MAXI body
// ---------------------------------------------------------------------------

function http_get(string $url): string
{
    echo "  → GET $url\n";
    $ctx  = stream_context_create(['http' => ['method' => 'GET', 'ignore_errors' => true]]);
    $body = file_get_contents($url, false, $ctx);
    if ($body === false) throw new RuntimeException("GET $url failed");
    $status = (int)(explode(' ', $http_response_header[0])[1] ?? 0);
    echo "  ← HTTP $status\n";
    print_raw($body);
    if ($status >= 400) throw new RuntimeException("GET $url → HTTP $status");
    return $body;
}

function http_post(string $url, string $body): string
{
    echo "  → POST $url\n";
    print_raw($body, 'request');
    $ctx  = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/maxi\r\nContent-Length: " . strlen($body),
        'content'       => $body,
        'ignore_errors' => true,
    ]]);
    $resp = file_get_contents($url, false, $ctx);
    if ($resp === false) throw new RuntimeException("POST $url failed");
    $status = (int)(explode(' ', $http_response_header[0])[1] ?? 0);
    echo "  ← HTTP $status\n";
    print_raw($resp, 'response');
    if ($status >= 400) throw new RuntimeException("POST $url → HTTP $status\n$resp");
    return $resp;
}

function http_put(string $url, string $body): string
{
    echo "  → PUT $url\n";
    print_raw($body, 'request');
    $ctx  = stream_context_create(['http' => [
        'method'        => 'PUT',
        'header'        => "Content-Type: application/maxi\r\nContent-Length: " . strlen($body),
        'content'       => $body,
        'ignore_errors' => true,
    ]]);
    $resp = file_get_contents($url, false, $ctx);
    if ($resp === false) throw new RuntimeException("PUT $url failed");
    $status = (int)(explode(' ', $http_response_header[0])[1] ?? 0);
    echo "  ← HTTP $status\n";
    print_raw($resp, 'response');
    if ($status >= 400) throw new RuntimeException("PUT $url → HTTP $status\n$resp");
    return $resp;
}

function http_delete(string $url): int
{
    echo "  → DELETE $url\n";
    $ctx  = stream_context_create(['http' => [
        'method'        => 'DELETE',
        'ignore_errors' => true,
    ]]);
    file_get_contents($url, false, $ctx);
    $status = (int)(explode(' ', $http_response_header[0])[1] ?? 0);
    echo "  ← HTTP $status\n";
    return $status;
}



$HR = str_repeat('─', 60);

function section(string $title): void
{
    global $HR;
    echo "\n$HR\n  $title\n$HR\n";
}

function print_table(array $headers, array $rows): void
{
    if (empty($rows)) { echo "  (no records)\n"; return; }
    $cols   = count($headers);
    $widths = array_fill(0, $cols, 0);
    for ($i = 0; $i < $cols; $i++) $widths[$i] = strlen($headers[$i]);
    foreach ($rows as $row) {
        $row = array_values((array)$row);
        for ($i = 0; $i < $cols; $i++) $widths[$i] = max($widths[$i], strlen((string)($row[$i] ?? '')));
    }
    $line = fn(array $cells) => '  ' . implode('  ', array_map(
        fn($i) => str_pad((string)($cells[$i] ?? ''), $widths[$i]),
        range(0, $cols - 1)
    ));
    echo $line($headers) . "\n";
    echo '  ' . implode('  ', array_map(fn($w) => str_repeat('─', $w), $widths)) . "\n";
    foreach ($rows as $row) { echo $line(array_values((array)$row)) . "\n"; }
}

/**
 * Print a MAXI body with a direction label (→ request / ← response).
 * Every line is indented with  │  so the wire format is visually distinct.
 */
function print_raw(string $text, string $dir = 'response'): void
{
    $arrow = $dir === 'request' ? '  ┌─ MAXI body (request)' : '  ┌─ MAXI body (response)';
    echo "$arrow\n";
    foreach (explode("\n", rtrim($text)) as $line) echo "  │ $line\n";
    echo "  └─\n";
}

// ---------------------------------------------------------------------------
// Reference helpers — resolve raw id refs via objectRegistry
// ---------------------------------------------------------------------------

function resolve(mixed $value, string $alias, ?array $registry): mixed
{
    if (!is_string($value) && !is_int($value)) return $value;
    $id = is_int($value) ? $value : (ctype_digit((string)$value) ? (int)$value : null);
    if ($id === null) return $value;
    return $registry[$alias][$id] ?? $value;
}

function transfer_str(array $values, array $reg): string
{
    [$id, $pRef, $fRef, $tRef, $date, $fee] = $values;
    $player   = resolve($pRef, 'P', $reg);
    $fromTeam = resolve($fRef, 'T', $reg);
    $toTeam   = resolve($tRef, 'T', $reg);
    $pName  = is_array($player)   ? $player['name']   : "#$pRef";
    $fName  = is_array($fromTeam) ? $fromTeam['name'] : "#$fRef";
    $tName  = is_array($toTeam)   ? $toTeam['name']   : "#$tRef";
    $feeStr = ($fee !== null && $fee !== '') ? '€' . number_format((float)$fee, 0, '.', ',') : 'free';
    return "  Transfer(#$id | $pName | $fName → $tName | $date | $feeStr)";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ── 1. GET /players ──────────────────────────────────────────────────────────
section('GET /players  (raw Maxi::parse → positional values)');
{
    $text   = http_get("$BASE_URL/players");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    print_table(['id', 'name', 'position', 'birthYear', 'teamId'],
        array_map(fn($r) => $r->values, $result->records));
}

// ── 2. GET /teams ─────────────────────────────────────────────────────────────
section('GET /teams');
{
    $text   = http_get("$BASE_URL/teams");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    print_table(['id', 'name', 'city', 'founded', 'coach'],
        array_map(fn($r) => $r->values, $result->records));
}

// ── 3. GET /teams/1 — team + roster ──────────────────────────────────────────
section('GET /teams/1  (team with roster)');
{
    $text   = http_get("$BASE_URL/teams/1");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    $types  = array_keys((array)$result->schema->types);
    echo "  Schema types in response: " . implode(', ', $types) . "\n";
    foreach ($result->records as $rec) {
        echo "  {$rec->alias}(" . implode(' | ', array_map('strval', $rec->values)) . ")\n";
    }
}

// ── 4. GET /games ─────────────────────────────────────────────────────────────
section('GET /games');
{
    $text   = http_get("$BASE_URL/games");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    print_table(['id', 'home', 'away', 'date', 'status', 'score'],
        array_map(fn($r) => [
            $r->values[0], $r->values[1], $r->values[2],
            $r->values[3], $r->values[4], "{$r->values[5]}–{$r->values[6]}",
        ], $result->records));
}

// ── 5. GET /games/1 — nested PlayerStats arrays ───────────────────────────────
section('GET /games/1  (GameDetail with nested S[] arrays)');
{
    $text   = http_get("$BASE_URL/games/1");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    foreach ($result->records as $rec) {
        if ($rec->alias !== 'D') continue;
        [$gameId, $home, $away] = $rec->values;
        echo "  GameDetail for game $gameId:\n";
        echo "  Home: " . json_encode($home, JSON_UNESCAPED_UNICODE) . "\n";
        echo "  Away: " . json_encode($away, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

// ── 6. GET /transfers — OBJECT REFERENCE RESOLUTION ──────────────────────────
section('GET /transfers  (object references → resolve via objectRegistry)');
{
    $text   = http_get("$BASE_URL/transfers");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    $reg    = $result->objectRegistry ?? [];
    echo "\n  Hydrated Transfer records (player/team resolved from objectRegistry):\n";
    foreach ($result->records as $rec) {
        if ($rec->alias !== 'X') continue;
        echo transfer_str($rec->values, $reg) . "\n";
    }
    $xRecs    = array_values(array_filter($result->records, fn($r) => $r->alias === 'X'));
    $resolved = !empty($xRecs) ? resolve($xRecs[0]->values[1], 'P', $reg) : null;
    echo "\n  ✓ player resolved to full array: " . (is_array($resolved) ? 'true' : 'false') . "\n";
    if (is_array($resolved)) echo "    player['name'] = {$resolved['name']}\n";
}

// ── 7. GET /players/3/transfers ───────────────────────────────────────────────
section('GET /players/3/transfers  (Carlos Rivera transfer history)');
{
    $text   = http_get("$BASE_URL/players/3/transfers");
    $result = Maxi::parse($text, ['loadSchema' => $loadSchema]);
    $reg    = $result->objectRegistry ?? [];
    foreach ($result->records as $rec) {
        if ($rec->alias !== 'X') continue;
        echo transfer_str($rec->values, $reg) . "\n";
    }
}

// ── 8. POST /players — send MAXI body, receive MAXI response ─────────────────
section('POST /players  (MAXI request body → MAXI response)');
{
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
    $newPlayer   = ['id' => 0, 'name' => 'Luca Bianchi', 'position' => 'forward', 'birthYear' => 2001, 'teamId' => 1];
    $requestBody = Maxi::dump([$newPlayer], [
        'schemaFile' => 'sports.mxs', 'defaultAlias' => 'P',
        'includeTypes' => false, 'types' => [$T_PLAYER],
    ]);

    $responseText = http_post("$BASE_URL/players", $requestBody);
    $result       = Maxi::parse($responseText, ['loadSchema' => $loadSchema]);
    [$createdId, $cName, $cPos, $cYear, $cTeam] = $result->records[0]->values;
    echo "\n  ✓ Created: Player($createdId | $cName | $cPos | $cYear | $cTeam)\n";

    // ── 9. PUT /players/:id ────────────────────────────────────────────────────
    section("PUT /players/$createdId  (update just-created player via MAXI body)");
    {
        $updated = ['id' => (int)$createdId, 'name' => $cName, 'position' => 'midfielder',
                    'birthYear' => (int)$cYear, 'teamId' => (int)$cTeam];
        $putBody = Maxi::dump([$updated], [
            'schemaFile' => 'sports.mxs', 'defaultAlias' => 'P',
            'includeTypes' => false, 'types' => [$T_PLAYER],
        ]);
        $responseText = http_put("$BASE_URL/players/$createdId", $putBody);
        $result       = Maxi::parse($responseText, ['loadSchema' => $loadSchema]);
        $v = $result->records[0]->values;
        echo "\n  ✓ Updated: Player({$v[0]} | {$v[1]} | {$v[2]} | {$v[3]} | {$v[4]})\n";
        echo "  ✓ position updated to: {$v[2]}\n";
    }

    // ── 10. DELETE /players/:id — clean up the demo player ───────────────────
    section("DELETE /players/$createdId  (clean up demo player)");
    http_delete("$BASE_URL/players/$createdId");
    echo "\n  ✓ Demo player removed — data is clean for the next run.\n";
}

echo "\n$HR\n  All endpoints validated successfully.\n$HR\n\n";
