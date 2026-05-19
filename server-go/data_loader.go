// data_loader.go — in-memory data store for the Sports Statistics API.
//
// JSON files are read once at startup into module-level slices.
// POST / PUT / DELETE mutate only the in-memory slices; the seed files on
// disk are never written to so the server always starts clean.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// ---------------------------------------------------------------------------
// Domain types (plain maps to stay schema-agnostic)
// ---------------------------------------------------------------------------

type Record = map[string]any

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

var (
	mu        sync.RWMutex
	players   []Record
	teams     []Record
	games     []Record
	gameStats []Record
	transfers []Record
)

// LoadData reads all JSON seed files from dataDir.
func LoadData(dataDir string) error {
	read := func(name string, dest *[]Record) error {
		b, err := os.ReadFile(filepath.Join(dataDir, name))
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		return json.Unmarshal(b, dest)
	}
	if err := read("players.json", &players); err != nil {
		return err
	}
	if err := read("teams.json", &teams); err != nil {
		return err
	}
	if err := read("games.json", &games); err != nil {
		return err
	}
	if err := read("game_stats.json", &gameStats); err != nil {
		return err
	}
	if err := read("transfers.json", &transfers); err != nil {
		return err
	}
	return nil
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

func LoadPlayers() []Record {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]Record, len(players))
	copy(out, players)
	return out
}

func SavePlayers(updated []Record) {
	mu.Lock()
	defer mu.Unlock()
	players = updated
}

func LoadPlayerByID(id int) (Record, bool) {
	mu.RLock()
	defer mu.RUnlock()
	for _, p := range players {
		if intVal(p["id"]) == id {
			return p, true
		}
	}
	return nil, false
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

func LoadTeams() []Record {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]Record, len(teams))
	copy(out, teams)
	return out
}

func LoadTeamByID(id int) (Record, bool) {
	mu.RLock()
	defer mu.RUnlock()
	for _, t := range teams {
		if intVal(t["id"]) == id {
			return t, true
		}
	}
	return nil, false
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

func LoadGames() []Record {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]Record, len(games))
	copy(out, games)
	return out
}

func LoadGameByID(id int) (Record, bool) {
	mu.RLock()
	defer mu.RUnlock()
	for _, g := range games {
		if intVal(g["id"]) == id {
			return g, true
		}
	}
	return nil, false
}

func LoadGameStatsByGameID(gameID int) (Record, bool) {
	mu.RLock()
	defer mu.RUnlock()
	for _, s := range gameStats {
		if intVal(s["gameId"]) == gameID {
			return s, true
		}
	}
	return nil, false
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

// LoadTransfersWithRefs joins transfer rows with player/team records.
// If playerID > 0, only transfers for that player are returned.
func LoadTransfersWithRefs(playerID int) []Record {
	mu.RLock()
	defer mu.RUnlock()

	playerMap := make(map[int]Record, len(players))
	for _, p := range players {
		playerMap[intVal(p["id"])] = p
	}
	teamMap := make(map[int]Record, len(teams))
	for _, t := range teams {
		teamMap[intVal(t["id"])] = t
	}

	var out []Record
	for _, t := range transfers {
		pid := intVal(t["playerId"])
		if playerID > 0 && pid != playerID {
			continue
		}
		fromID := intVal(t["fromTeamId"])
		toID := intVal(t["toTeamId"])
		p, okP := playerMap[pid]
		f, okF := teamMap[fromID]
		to, okT := teamMap[toID]
		if !okP || !okF || !okT {
			continue
		}
		row := Record{
			"id":       t["id"],
			"player":   p,
			"fromTeam": f,
			"toTeam":   to,
			"date":     t["date"],
			"fee":      t["fee"],
		}
		out = append(out, row)
	}
	return out
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// intVal coerces any numeric JSON value to int.
func intVal(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	case float32:
		return int(n)
	}
	return 0
}

