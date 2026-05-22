// client.go — Sports Statistics API CLI Client (Go)
//
// Every request/response MAXI body is printed inline so you can see exactly
// what wire format is exchanged.
//
// Usage:
//
//	BASE_URL=http://localhost:8050 go run .
package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/maxi-format/maxi-go/api"
	"github.com/maxi-format/maxi-go/core"
)

var (
	baseURL   string
	sharedDir string
)

// ---------------------------------------------------------------------------
// Schema loader
// ---------------------------------------------------------------------------

func loadSchema(name string) (string, error) {
	safe := ""
	for _, c := range name {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
			c == '.' || c == '_' || c == '-' {
			safe += string(c)
		}
	}
	b, err := os.ReadFile(filepath.Join(sharedDir, safe))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func parseOpts() core.ParseOptions {
	opts := core.DefaultParseOptions()
	opts.LoadSchema = loadSchema
	return opts
}

// ---------------------------------------------------------------------------
// HTTP helpers — print method, URL, status and raw MAXI body
// ---------------------------------------------------------------------------

const hr = "────────────────────────────────────────────────────────────"

func section(title string) {
	fmt.Printf("\n%s\n  %s\n%s\n", hr, title, hr)
}

func printRaw(text, direction string) {
	label := "MAXI body (request)"
	if direction == "response" {
		label = "MAXI body (response)"
	}
	fmt.Printf("  ┌─ %s\n", label)
	for _, line := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
		fmt.Printf("  │ %s\n", line)
	}
	fmt.Println("  └─")
}

func httpGet(path string) string {
	url := baseURL + path
	fmt.Printf("  → GET %s\n", url)
	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		log.Fatalf("GET %s: %v", path, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("  ← HTTP %d\n", resp.StatusCode)
	printRaw(string(body), "response")
	if resp.StatusCode >= 400 {
		log.Fatalf("GET %s → HTTP %d", path, resp.StatusCode)
	}
	return string(body)
}

func httpPost(path, body string) string {
	url := baseURL + path
	fmt.Printf("  → POST %s\n", url)
	printRaw(body, "request")
	resp, err := http.Post(url, "application/maxi", bytes.NewBufferString(body)) //nolint:gosec
	if err != nil {
		log.Fatalf("POST %s: %v", path, err)
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	fmt.Printf("  ← HTTP %d\n", resp.StatusCode)
	printRaw(string(rb), "response")
	if resp.StatusCode >= 400 {
		log.Fatalf("POST %s → HTTP %d", path, resp.StatusCode)
	}
	return string(rb)
}

func httpPut(path, body string) string {
	url := baseURL + path
	fmt.Printf("  → PUT %s\n", url)
	printRaw(body, "request")
	req, _ := http.NewRequest(http.MethodPut, url, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/maxi")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("PUT %s: %v", path, err)
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	fmt.Printf("  ← HTTP %d\n", resp.StatusCode)
	printRaw(string(rb), "response")
	if resp.StatusCode >= 400 {
		log.Fatalf("PUT %s → HTTP %d", path, resp.StatusCode)
	}
	return string(rb)
}

func httpDelete(path string) int {
	url := baseURL + path
	fmt.Printf("  → DELETE %s\n", url)
	req, _ := http.NewRequest(http.MethodDelete, url, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("DELETE %s: %v", path, err)
	}
	defer resp.Body.Close()
	fmt.Printf("  ← HTTP %d\n", resp.StatusCode)
	return resp.StatusCode
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

func printTable(headers []string, rows [][]string) {
	if len(rows) == 0 {
		fmt.Println("  (no records)")
		return
	}
	widths := make([]int, len(headers))
	for i, h := range headers {
		widths[i] = len(h)
	}
	for _, row := range rows {
		for i, v := range row {
			if i < len(widths) && len(v) > widths[i] {
				widths[i] = len(v)
			}
		}
	}
	pad := func(s string, w int) string {
		if len(s) >= w {
			return s
		}
		return s + strings.Repeat(" ", w-len(s))
	}
	fmtRow := func(cells []string) string {
		parts := make([]string, len(headers))
		for i := range headers {
			v := ""
			if i < len(cells) {
				v = cells[i]
			}
			parts[i] = pad(v, widths[i])
		}
		return "  " + strings.Join(parts, "  ")
	}
	fmt.Println(fmtRow(headers))
	dividers := make([]string, len(headers))
	for i, w := range widths {
		dividers[i] = strings.Repeat("─", w)
	}
	fmt.Println("  " + strings.Join(dividers, "  "))
	for _, row := range rows {
		fmt.Println(fmtRow(row))
	}
}

// ---------------------------------------------------------------------------
// Reference helpers
// ---------------------------------------------------------------------------

type ObjectRegistry = api.ObjectRegistry

func getRegistry(result *core.MaxiParseResult) ObjectRegistry {
	return api.GetObjectRegistry(result)
}

func resolveRef(val any, alias string, reg ObjectRegistry) map[string]any {
	if reg == nil {
		return nil
	}
	idStr := fmt.Sprintf("%v", val)
	aliasReg := reg[alias]
	if aliasReg == nil {
		return nil
	}
	return aliasReg[idStr]
}

func strOrRef(val any, alias string, reg ObjectRegistry, nameField string) string {
	if obj := resolveRef(val, alias, reg); obj != nil {
		if n, ok := obj[nameField].(string); ok {
			return n
		}
	}
	return fmt.Sprintf("#%v", val)
}

func anyStr(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func feeStr(v any) string {
	if v == nil {
		return "free"
	}
	s := fmt.Sprintf("%v", v)
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return fmt.Sprintf("€%d", int(f))
	}
	return s
}

// ---------------------------------------------------------------------------
// Player type def (for POST/PUT request body)
// ---------------------------------------------------------------------------

var tPlayer = &core.MaxiTypeDef{
	Alias: "P", Name: "Player",
	Fields: []*core.MaxiFieldDef{
		{Name: "id", TypeExpr: "int"},
		{Name: "name"},
		{Name: "position", TypeExpr: "enum[forward,midfielder,defender,goalkeeper]"},
		{Name: "birthYear", TypeExpr: "int"},
		{Name: "team", TypeExpr: "T"},
	},
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

func main() {
	baseURL = strings.TrimRight(os.Getenv("BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "http://localhost:8050"
	}

	// Shared schema files: ../shared relative to this binary or CWD
	exeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	sharedDir = filepath.Join(exeDir, "shared")
	if _, err := os.Stat(sharedDir); os.IsNotExist(err) {
		sharedDir = filepath.Join("..", "shared")
	}

	// ── 1. GET /players ─────────────────────────────────────────────────────
	section("GET /players  (raw parse → positional values)")
	text := httpGet("/players")
	res, err := api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /players: %v", err)
	}
	var playerRows [][]string
	for _, rec := range res.Records {
		if rec.Alias == "P" {
			playerRows = append(playerRows, []string{
				anyStr(rec.Values[0]), anyStr(rec.Values[1]),
				anyStr(rec.Values[2]), anyStr(rec.Values[3]), anyStr(rec.Values[4]),
			})
		}
	}
	printTable([]string{"id", "name", "position", "birthYear", "team"}, playerRows)

	// ── 2. GET /teams ────────────────────────────────────────────────────────
	section("GET /teams")
	text = httpGet("/teams")
	res, err = api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /teams: %v", err)
	}
	var teamRows [][]string
	for _, rec := range res.Records {
		if rec.Alias == "T" {
			teamRows = append(teamRows, []string{
				anyStr(rec.Values[0]), anyStr(rec.Values[1]),
				anyStr(rec.Values[2]), anyStr(rec.Values[3]), anyStr(rec.Values[4]),
			})
		}
	}
	printTable([]string{"id", "name", "city", "founded", "coach"}, teamRows)

	// ── 3. GET /teams/1 ──────────────────────────────────────────────────────
	section("GET /teams/1  (team + roster)")
	text = httpGet("/teams/1")
	res, err = api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /teams/1: %v", err)
	}
	var typeNames []string
	for _, td := range res.Schema.Types() {
		typeNames = append(typeNames, td.Alias)
	}
	fmt.Printf("  Schema types in response: %s\n", strings.Join(typeNames, ", "))
	for _, rec := range res.Records {
		vals := make([]string, len(rec.Values))
		for i, v := range rec.Values {
			vals[i] = anyStr(v)
		}
		fmt.Printf("  %s(%s)\n", rec.Alias, strings.Join(vals, " | "))
	}

	// ── 4. GET /games ────────────────────────────────────────────────────────
	section("GET /games")
	text = httpGet("/games")
	res, err = api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /games: %v", err)
	}
	var gameRows [][]string
	gameReg := getRegistry(res)
	for _, rec := range res.Records {
		if rec.Alias == "G" && len(rec.Values) >= 7 {
			home := strOrRef(rec.Values[1], "T", gameReg, "name")
			away := strOrRef(rec.Values[2], "T", gameReg, "name")
			score := fmt.Sprintf("%v\u2013%v", rec.Values[5], rec.Values[6])
			gameRows = append(gameRows, []string{
				anyStr(rec.Values[0]), home, away,
				anyStr(rec.Values[3]), anyStr(rec.Values[4]), score,
			})
		}
	}
	printTable([]string{"id", "home", "away", "date", "status", "score"}, gameRows)

	// ── 5. GET /games/1 ──────────────────────────────────────────────────────
	section("GET /games/1  (GameDetail with nested S[] arrays)")
	text = httpGet("/games/1")
	res, err = api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /games/1: %v", err)
	}
	gameReg = getRegistry(res)
	sByPlayer := map[string]map[string]any{}
	for _, rec := range res.Records {
		if rec.Alias == "S" && len(rec.Values) >= 4 {
			pid := fmt.Sprintf("%v", rec.Values[0])
			sByPlayer[pid] = map[string]any{
				"player":        rec.Values[0],
				"goals":         rec.Values[1],
				"assists":       rec.Values[2],
				"minutesPlayed": rec.Values[3],
			}
		}
	}
	toStatRows := func(arr any) [][]string {
		items, _ := arr.([]any)
		rows := make([][]string, 0, len(items))
		for _, item := range items {
			m, ok := item.(map[string]any)
			if !ok {
				m = sByPlayer[fmt.Sprintf("%v", item)]
				if m == nil {
					continue
				}
			}
			p := resolveRef(m["player"], "P", gameReg)
			name := anyStr(m["player"])
			if p != nil {
				if n, ok := p["name"].(string); ok {
					name = n
				}
			}
			rows = append(rows, []string{name, anyStr(m["goals"]), anyStr(m["assists"]), anyStr(m["minutesPlayed"])})
		}
		return rows
	}
	for _, rec := range res.Records {
		if rec.Alias == "D" && len(rec.Values) >= 3 {
			fmt.Printf("  GameDetail for game %v:\n", rec.Values[0])
			fmt.Println("  Home:")
			printTable([]string{"name", "goals", "assists", "minutes"}, toStatRows(rec.Values[1]))
			fmt.Println("  Away:")
			printTable([]string{"name", "goals", "assists", "minutes"}, toStatRows(rec.Values[2]))
		}
	}

	// ── 6. GET /transfers — object reference resolution ──────────────────────
	section("GET /transfers  (object references → resolve via ObjectRegistry)")
	text = httpGet("/transfers")
	res, err = api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /transfers: %v", err)
	}
	reg := getRegistry(res)
	fmt.Println("\n  Hydrated Transfer records (player/team resolved from ObjectRegistry):")
	for _, rec := range res.Records {
		if rec.Alias == "X" && len(rec.Values) >= 6 {
			pName := strOrRef(rec.Values[1], "P", reg, "name")
			fName := strOrRef(rec.Values[2], "T", reg, "name")
			tName := strOrRef(rec.Values[3], "T", reg, "name")
			fmt.Printf("  Transfer(#%v | %s | %s → %s | %v | %s)\n",
				rec.Values[0], pName, fName, tName, rec.Values[4], feeStr(rec.Values[5]))
		}
	}
	xRecs := []*core.MaxiRecord{}
	for _, rec := range res.Records {
		if rec.Alias == "X" {
			xRecs = append(xRecs, rec)
		}
	}
	if len(xRecs) > 0 {
		resolved := resolveRef(xRecs[0].Values[1], "P", reg)
		fmt.Printf("\n  ✓ player resolved to full dict: %v\n", resolved != nil)
		if resolved != nil {
			fmt.Printf("    player['name'] = %v\n", resolved["name"])
		}
	}

	// ── 7. GET /players/3/transfers ──────────────────────────────────────────
	section("GET /players/3/transfers  (player transfer history)")
	text = httpGet("/players/3/transfers")
	res, err = api.ParseMaxi(text, parseOpts())
	if err != nil {
		log.Fatalf("parse /players/3/transfers: %v", err)
	}
	reg = getRegistry(res)
	for _, rec := range res.Records {
		if rec.Alias == "X" && len(rec.Values) >= 6 {
			pName := strOrRef(rec.Values[1], "P", reg, "name")
			fName := strOrRef(rec.Values[2], "T", reg, "name")
			tName := strOrRef(rec.Values[3], "T", reg, "name")
			fmt.Printf("  Transfer(#%v | %s | %s → %s | %v | %s)\n",
				rec.Values[0], pName, fName, tName, rec.Values[4], feeStr(rec.Values[5]))
		}
	}

	// ── 8. POST /players ─────────────────────────────────────────────────────
	section("POST /players  (MAXI request body → MAXI response)")
	newPlayer := map[string]any{
		"id": 0, "name": "Luca Bianchi", "position": "forward",
		"birthYear": 2001, "team": 1,
	}
	requestBody, err := api.DumpMaxi([]map[string]any{newPlayer}, api.DumpOptions{
		SchemaFile:        "sports.mxs",
		DefaultAlias:      "P",
		Types:             []*core.MaxiTypeDef{tPlayer},
		IncludeTypes:      false,
		CollectReferences: true,
	})
	if err != nil {
		log.Fatalf("dump POST body: %v", err)
	}
	responseText := httpPost("/players", requestBody)
	res, err = api.ParseMaxi(responseText, parseOpts())
	if err != nil || len(res.Records) == 0 {
		log.Fatalf("parse POST response: %v", err)
	}
	v := res.Records[0].Values
	createdID := anyStr(v[0])
	fmt.Printf("\n  ✓ Created: Player(%s | %v | %v | %v | %v)\n",
		createdID, v[1], v[2], v[3], v[4])

	// ── 9. PUT /players/:id ──────────────────────────────────────────────────
	section(fmt.Sprintf("PUT /players/%s  (update just-created player)", createdID))
	cID, _ := strconv.Atoi(createdID)
	updated := map[string]any{
		"id": cID, "name": anyStr(v[1]), "position": "midfielder",
		"birthYear": v[3], "team": v[4],
	}
	putBody, err := api.DumpMaxi([]map[string]any{updated}, api.DumpOptions{
		SchemaFile:        "sports.mxs",
		DefaultAlias:      "P",
		Types:             []*core.MaxiTypeDef{tPlayer},
		IncludeTypes:      false,
		CollectReferences: true,
	})
	if err != nil {
		log.Fatalf("dump PUT body: %v", err)
	}
	responseText = httpPut("/players/"+createdID, putBody)
	res, err = api.ParseMaxi(responseText, parseOpts())
	if err != nil || len(res.Records) == 0 {
		log.Fatalf("parse PUT response: %v", err)
	}
	vv := res.Records[0].Values
	fmt.Printf("\n  ✓ Updated: Player(%v | %v | %v | %v | %v)\n", vv[0], vv[1], vv[2], vv[3], vv[4])
	fmt.Printf("  ✓ position updated to: %v\n", vv[2])

	// ── 10. DELETE /players/:id ──────────────────────────────────────────────
	section(fmt.Sprintf("DELETE /players/%s  (clean up demo player)", createdID))
	httpDelete("/players/" + createdID)
	fmt.Println("\n  ✓ Demo player removed — data is clean for the next run.")

	fmt.Printf("\n%s\n  All endpoints validated successfully.\n%s\n\n", hr, hr)
}


