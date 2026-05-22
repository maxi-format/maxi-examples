<?php

declare(strict_types=1);

/**
 * DataLoader.php — in-memory-style data store for the Sports Statistics API.
 *
 * Seed files in shared/data/ are NEVER written to.
 * POST / PUT / DELETE write to a per-run temp directory (sys_get_temp_dir())
 * that is separate from the seed data, so the originals stay untouched.
 * On container restart the temp files disappear and the seeds are used again.
 */

namespace App;

use RuntimeException;

class DataLoader
{
    private string $dataDir;
    private string $tempDir;

    public function __construct(string $dataDir)
    {
        $this->dataDir = rtrim($dataDir, '/\\');
        // Temp dir lives in /tmp (or OS equivalent) — never inside the repo
        $this->tempDir = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'maxi-sports-api';
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Read from the temp overlay if it exists, otherwise fall back to seed data.
     */
    private function read(string $filename): array
    {
        $tmpPath  = $this->tempDir . DIRECTORY_SEPARATOR . $filename;
        $seedPath = $this->dataDir . DIRECTORY_SEPARATOR . $filename;
        $path     = file_exists($tmpPath) ? $tmpPath : $seedPath;
        if (!file_exists($path)) {
            throw new RuntimeException("Data file not found: $seedPath");
        }
        return json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * Write to the temp overlay — the seed file is never touched.
     */
    private function write(string $filename, array $data): void
    {
        $path = $this->tempDir . DIRECTORY_SEPARATOR . $filename;
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    // -------------------------------------------------------------------------
    // Players
    // -------------------------------------------------------------------------

    public function loadPlayers(): array
    {
        return $this->read('players.json');
    }

    public function savePlayers(array $players): void
    {
        $this->write('players.json', $players);
    }

    public function loadPlayerById(int $id): ?array
    {
        foreach ($this->loadPlayers() as $player) {
            if ($player['id'] === $id) return $player;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Players with team join
    // -------------------------------------------------------------------------

    public function loadPlayersWithTeams(): array
    {
        $teams = [];
        foreach ($this->loadTeams() as $t) { $teams[$t['id']] = $t; }
        $result = [];
        foreach ($this->loadPlayers() as $p) {
            $teamId = $p['teamId'];
            if (!isset($teams[$teamId])) continue;
            $player = array_diff_key($p, ['teamId' => true]);
            $player['team'] = $teams[$teamId];
            $result[] = $player;
        }
        return $result;
    }

    public function loadPlayerByIdWithTeam(int $id): ?array
    {
        $teams = [];
        foreach ($this->loadTeams() as $t) { $teams[$t['id']] = $t; }
        foreach ($this->loadPlayers() as $p) {
            if ($p['id'] !== $id) continue;
            $teamId = $p['teamId'];
            if (!isset($teams[$teamId])) return null;
            $player = array_diff_key($p, ['teamId' => true]);
            $player['team'] = $teams[$teamId];
            return $player;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Teams
    // -------------------------------------------------------------------------

    public function loadTeams(): array
    {
        return $this->read('teams.json');
    }

    public function loadTeamById(int $id): ?array
    {
        foreach ($this->loadTeams() as $team) {
            if ($team['id'] === $id) return $team;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Games
    // -------------------------------------------------------------------------

    public function loadGames(): array
    {
        return $this->read('games.json');
    }

    public function loadGameById(int $id): ?array
    {
        foreach ($this->loadGames() as $game) {
            if ($game['id'] === $id) return $game;
        }
        return null;
    }

    public function loadGameStatsByGameId(int $gameId): ?array
    {
        foreach ($this->read('game_stats.json') as $stats) {
            if ($stats['gameId'] === $gameId) return $stats;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Transfers — returns rows with nested player/team arrays for dumpMaxi
    // -------------------------------------------------------------------------

    public function loadTransfersWithRefs(?int $filterPlayerId = null): array
    {
        $raw     = $this->read('transfers.json');
        $players = [];
        foreach ($this->loadPlayers() as $p) { $players[$p['id']] = $p; }
        $teams = [];
        foreach ($this->loadTeams() as $t)   { $teams[$t['id']]   = $t; }

        if ($filterPlayerId !== null) {
            $raw = array_values(array_filter($raw, fn($t) => $t['playerId'] === $filterPlayerId));
        }

        $raw = array_values(array_filter(
            $raw,
            fn($t) => isset($players[$t['playerId']])
                   && isset($teams[$t['fromTeamId']])
                   && isset($teams[$t['toTeamId']])
        ));

        // Keep player.team as an int ID — the full team is already in the pool
        // via fromTeam/toTeam, so the reference pool won't have duplicates.
        return array_map(fn($t) => [
            'id'       => $t['id'],
            'player'   => array_merge(
                array_diff_key($players[$t['playerId']], ['teamId' => true]),
                ['team' => $players[$t['playerId']]['teamId']]
            ),
            'fromTeam' => $teams[$t['fromTeamId']],
            'toTeam'   => $teams[$t['toTeamId']],
            'date'     => $t['date'],
            'fee'      => $t['fee'] ?? null,
        ], $raw);
    }

    // -------------------------------------------------------------------------
    // Games with team join
    // -------------------------------------------------------------------------

    public function loadGamesWithTeams(): array
    {
        $teams = [];
        foreach ($this->loadTeams() as $t) { $teams[$t['id']] = $t; }
        $result = [];
        foreach ($this->loadGames() as $g) {
            $ht = $teams[$g['homeTeamId']] ?? null;
            $at = $teams[$g['awayTeamId']] ?? null;
            if (!$ht || !$at) continue;
            $game = array_diff_key($g, ['homeTeamId' => true, 'awayTeamId' => true]);
            $game['homeTeam'] = $ht;
            $game['awayTeam'] = $at;
            $result[] = $game;
        }
        return $result;
    }

    public function loadGameByIdWithTeams(int $id): ?array
    {
        $teams = [];
        foreach ($this->loadTeams() as $t) { $teams[$t['id']] = $t; }
        foreach ($this->loadGames() as $g) {
            if ($g['id'] !== $id) continue;
            $ht = $teams[$g['homeTeamId']] ?? null;
            $at = $teams[$g['awayTeamId']] ?? null;
            if (!$ht || !$at) return null;
            $game = array_diff_key($g, ['homeTeamId' => true, 'awayTeamId' => true]);
            $game['homeTeam'] = $ht;
            $game['awayTeam'] = $at;
            return $game;
        }
        return null;
    }

    public function loadGameStatsByGameIdWithPlayers(int $gameId): ?array
    {
        $stats = $this->loadGameStatsByGameId($gameId);
        if ($stats === null) return null;
        $playerMap = [];
        foreach ($this->loadPlayersWithTeams() as $p) { $playerMap[$p['id']] = $p; }
        $enrich = function (array $arr) use ($playerMap): array {
            $out = [];
            foreach ($arr as $s) {
                if (!isset($playerMap[$s['playerId']])) continue;
                $stat = array_diff_key($s, ['playerId' => true]);
                $stat['player'] = $playerMap[$s['playerId']];
                $out[] = $stat;
            }
            return $out;
        };
        return array_merge(
            array_diff_key($stats, ['homePlayers' => true, 'awayPlayers' => true]),
            ['homePlayers' => $enrich($stats['homePlayers'] ?? [])],
            ['awayPlayers' => $enrich($stats['awayPlayers'] ?? [])],
        );
    }
}
