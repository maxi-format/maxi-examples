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

        return array_map(fn($t) => [
            'id'       => $t['id'],
            'player'   => $players[$t['playerId']],
            'fromTeam' => $teams[$t['fromTeamId']],
            'toTeam'   => $teams[$t['toTeamId']],
            'date'     => $t['date'],
            'fee'      => $t['fee'] ?? null,
        ], $raw);
    }
}
