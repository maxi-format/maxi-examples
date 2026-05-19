// server.go — Sports Statistics API (Go / net/http)
// Wire format: application/maxi
//
// Mirrors the endpoints of ../server-py/server.py and ../server-js/server.js.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/maxi-format/maxi-go/api"
	"github.com/maxi-format/maxi-go/core"
)

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

var (
	sharedDir string
	port      string
)

// ---------------------------------------------------------------------------
// Type definitions — mirror sports.mxs
// ---------------------------------------------------------------------------

func makeField(name string, extras ...string) *core.MaxiFieldDef {
	f := &core.MaxiFieldDef{Name: name}
	for i := 0; i+1 < len(extras); i += 2 {
		switch extras[i] {
		case "type":
			f.TypeExpr = extras[i+1]
		case "ann":
			f.Annotation = extras[i+1]
		case "default":
			f.DefaultValue = extras[i+1]
		case "required":
			f.Constraints = append(f.Constraints, core.ParsedConstraint{Type: core.ConstraintRequired})
		}
	}
	return f
}

var (
	tPlayer = &core.MaxiTypeDef{
		Alias: "P", Name: "Player",
		Fields: []*core.MaxiFieldDef{
			makeField("id", "type", "int"),
			makeField("name", "required", "true"),
			makeField("position", "type", "enum[forward,midfielder,defender,goalkeeper]"),
			makeField("birthYear", "type", "int"),
			makeField("teamId", "type", "int"),
		},
	}
	tTeam = &core.MaxiTypeDef{
		Alias: "T", Name: "Team",
		Fields: []*core.MaxiFieldDef{
			makeField("id", "type", "int"),
			makeField("name", "required", "true"),
			makeField("city", "required", "true"),
			makeField("founded", "type", "int"),
			makeField("coach", "required", "true"),
		},
	}
	tStats = &core.MaxiTypeDef{
		Alias: "S", Name: "PlayerStats",
		Fields: []*core.MaxiFieldDef{
			makeField("playerId", "type", "int"),
			makeField("goals", "type", "int", "default", "0"),
			makeField("assists", "type", "int", "default", "0"),
			makeField("minutesPlayed", "type", "int", "default", "0"),
		},
	}
	tGame = &core.MaxiTypeDef{
		Alias: "G", Name: "Game",
		Fields: []*core.MaxiFieldDef{
			makeField("id", "type", "int"),
			makeField("homeTeamId", "type", "int"),
			makeField("awayTeamId", "type", "int"),
			makeField("date", "ann", "date", "required", "true"),
			makeField("status", "type", "enum[scheduled,live,finished,cancelled]"),
			makeField("homeScore", "type", "int", "default", "0"),
			makeField("awayScore", "type", "int", "default", "0"),
		},
	}
	tGameDetail = &core.MaxiTypeDef{
		Alias: "D", Name: "GameDetail",
		Fields: []*core.MaxiFieldDef{
			makeField("gameId", "type", "int"),
			makeField("homePlayers", "type", "S[]"),
			makeField("awayPlayers", "type", "S[]"),
		},
	}
	tTransfer = &core.MaxiTypeDef{
		Alias: "X", Name: "Transfer",
		Fields: []*core.MaxiFieldDef{
			makeField("id", "type", "int"),
			makeField("player", "type", "P"),
			makeField("fromTeam", "type", "T"),
			makeField("toTeam", "type", "T"),
			makeField("date", "ann", "date", "required", "true"),
			makeField("fee", "type", "decimal"),
		},
	}
)

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

func loadSchemaFile(name string) (string, error) {
	safe := regexp.MustCompile(`[^a-zA-Z0-9._-]`).ReplaceAllString(name, "")
	b, err := os.ReadFile(filepath.Join(sharedDir, safe))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func maxiResponse(w http.ResponseWriter, data any, alias string, types []*core.MaxiTypeDef, status int) {
	var dataMap map[string][]map[string]any

	switch v := data.(type) {
	case []Record:
		rows := make([]map[string]any, len(v))
		for i, r := range v {
			rows[i] = map[string]any(r)
		}
		dataMap = map[string][]map[string]any{alias: rows}
	case map[string][]Record:
		dataMap = make(map[string][]map[string]any, len(v))
		for k, recs := range v {
			rows := make([]map[string]any, len(recs))
			for i, r := range recs {
				rows[i] = map[string]any(r)
			}
			dataMap[k] = rows
		}
	}

	opts := api.DumpOptions{
		SchemaFile:        "sports.mxs",
		DefaultAlias:      alias,
		Types:             types,
		IncludeTypes:      false,
		CollectReferences: true,
	}
	body, err := api.DumpMaxi(dataMap, opts)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/maxi")
	w.WriteHeader(status)
	fmt.Fprint(w, body)
}

func maxiNotFound(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/maxi")
	w.WriteHeader(http.StatusNotFound)
}

func parseMaxiBody(r *http.Request) (*core.MaxiParseResult, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	opts := core.DefaultParseOptions()
	opts.LoadSchema = func(name string) (string, error) { return loadSchemaFile(name) }
	return api.ParseMaxi(string(body), opts)
}

func addCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------------------------
// Router (stdlib mux)
// ---------------------------------------------------------------------------

func newMux() *http.ServeMux {
	mux := http.NewServeMux()

	// Schema
	mux.HandleFunc("GET /schema/{name}", handleGetSchema)

	// Players
	mux.HandleFunc("GET /players", handleGetPlayers)
	mux.HandleFunc("GET /players/{id}", handleGetPlayer)
	mux.HandleFunc("POST /players", handleCreatePlayer)
	mux.HandleFunc("PUT /players/{id}", handleUpdatePlayer)
	mux.HandleFunc("DELETE /players/{id}", handleDeletePlayer)
	mux.HandleFunc("GET /players/{id}/transfers", handleGetPlayerTransfers)

	// Teams
	mux.HandleFunc("GET /teams", handleGetTeams)
	mux.HandleFunc("GET /teams/{id}", handleGetTeam)

	// Games
	mux.HandleFunc("GET /games", handleGetGames)
	mux.HandleFunc("GET /games/{id}", handleGetGame)

	// Transfers
	mux.HandleFunc("GET /transfers", handleGetTransfers)

	return mux
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func handleGetSchema(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	content, err := loadSchemaFile(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprint(w, content)
}

// --- Players ---

func handleGetPlayers(w http.ResponseWriter, r *http.Request) {
	maxiResponse(w, LoadPlayers(), "P", []*core.MaxiTypeDef{tPlayer}, http.StatusOK)
}

func handleGetPlayer(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	p, ok := LoadPlayerByID(id)
	if !ok {
		maxiNotFound(w)
		return
	}
	maxiResponse(w, []Record{p}, "P", []*core.MaxiTypeDef{tPlayer}, http.StatusOK)
}

func handleCreatePlayer(w http.ResponseWriter, r *http.Request) {
	parsed, err := parseMaxiBody(r)
	if err != nil || len(parsed.Records) == 0 {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	existing := LoadPlayers()
	newID := 1
	for _, p := range existing {
		if n := intVal(p["id"]); n >= newID {
			newID = n + 1
		}
	}
	v := parsed.Records[0].Values
	player := Record{
		"id":        newID,
		"name":      strVal(v, 1),
		"position":  strVal(v, 2),
		"birthYear": intFromAny(v, 3),
		"teamId":    intFromAny(v, 4),
	}
	SavePlayers(append(existing, player))
	maxiResponse(w, []Record{player}, "P", []*core.MaxiTypeDef{tPlayer}, http.StatusCreated)
}

func handleUpdatePlayer(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	parsed, err := parseMaxiBody(r)
	if err != nil || len(parsed.Records) == 0 {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	existing := LoadPlayers()
	idx := -1
	for i, p := range existing {
		if intVal(p["id"]) == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		maxiNotFound(w)
		return
	}
	v := parsed.Records[0].Values
	existing[idx] = Record{
		"id":        id,
		"name":      strVal(v, 1),
		"position":  strVal(v, 2),
		"birthYear": intFromAny(v, 3),
		"teamId":    intFromAny(v, 4),
	}
	SavePlayers(existing)
	maxiResponse(w, []Record{existing[idx]}, "P", []*core.MaxiTypeDef{tPlayer}, http.StatusOK)
}

func handleDeletePlayer(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	existing := LoadPlayers()
	idx := -1
	for i, p := range existing {
		if intVal(p["id"]) == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		maxiNotFound(w)
		return
	}
	SavePlayers(append(existing[:idx], existing[idx+1:]...))
	w.WriteHeader(http.StatusNoContent)
}

func handleGetPlayerTransfers(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	rows := LoadTransfersWithRefs(id)
	if len(rows) == 0 {
		maxiNotFound(w)
		return
	}
	maxiResponse(w, rows, "X", []*core.MaxiTypeDef{tPlayer, tTeam, tTransfer}, http.StatusOK)
}

// --- Teams ---

func handleGetTeams(w http.ResponseWriter, r *http.Request) {
	maxiResponse(w, LoadTeams(), "T", []*core.MaxiTypeDef{tTeam}, http.StatusOK)
}

func handleGetTeam(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	team, ok := LoadTeamByID(id)
	if !ok {
		maxiNotFound(w)
		return
	}
	roster := []Record{}
	for _, p := range LoadPlayers() {
		if intVal(p["teamId"]) == id {
			roster = append(roster, p)
		}
	}
	maxiResponse(w,
		map[string][]Record{"T": {team}, "P": roster},
		"T",
		[]*core.MaxiTypeDef{tTeam, tPlayer},
		http.StatusOK,
	)
}

// --- Games ---

func handleGetGames(w http.ResponseWriter, r *http.Request) {
	maxiResponse(w, LoadGames(), "G", []*core.MaxiTypeDef{tGame}, http.StatusOK)
}

func handleGetGame(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	game, ok := LoadGameByID(id)
	if !ok {
		maxiNotFound(w)
		return
	}
	stats, hasStats := LoadGameStatsByGameID(id)
	if hasStats {
		maxiResponse(w,
			map[string][]Record{"G": {game}, "D": {stats}},
			"G",
			[]*core.MaxiTypeDef{tGame, tStats, tGameDetail},
			http.StatusOK,
		)
		return
	}
	maxiResponse(w, []Record{game}, "G", []*core.MaxiTypeDef{tGame}, http.StatusOK)
}

// --- Transfers ---

func handleGetTransfers(w http.ResponseWriter, r *http.Request) {
	rows := LoadTransfersWithRefs(0)
	maxiResponse(w, rows, "X", []*core.MaxiTypeDef{tPlayer, tTeam, tTransfer}, http.StatusOK)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

func main() {
	port = os.Getenv("PORT")
	if port == "" {
		port = "8050"
	}

	// Shared data directory: ../shared relative to this binary.
	// In Docker it will be /app/shared; locally it's found via the source tree.
	exeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	sharedDir = filepath.Join(exeDir, "shared")
	if _, err := os.Stat(sharedDir); os.IsNotExist(err) {
		// Fallback for running via `go run` from the source directory
		sharedDir = filepath.Join("..", "shared")
	}

	if err := LoadData(filepath.Join(sharedDir, "data")); err != nil {
		log.Fatalf("failed to load data: %v", err)
	}

	mux := newMux()
	handler := addCORS(mux)

	log.Printf("Sports API (MAXI/Go) listening on http://0.0.0.0:%s", port)
	log.Printf("Endpoints: GET /players  GET /teams  GET /games  GET /transfers  ...")
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

func strVal(vals []any, i int) string {
	if i >= len(vals) || vals[i] == nil {
		return ""
	}
	return fmt.Sprintf("%v", vals[i])
}

func intFromAny(vals []any, i int) int {
	if i >= len(vals) || vals[i] == nil {
		return 0
	}
	switch n := vals[i].(type) {
	case int64:
		return int(n)
	case int:
		return n
	case float64:
		return int(n)
	case string:
		v, _ := strconv.Atoi(strings.TrimSpace(n))
		return v
	}
	return 0
}

// jsonString formats v as a compact JSON string (used in log output).
func jsonString(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

var _ = jsonString // suppress unused warning
