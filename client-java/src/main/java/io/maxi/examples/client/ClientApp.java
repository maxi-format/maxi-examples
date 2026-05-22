package io.maxi.examples.client;

import io.maxi.api.Maxi;
import io.maxi.core.DumpOptions;
import io.maxi.core.MaxiParseException;
import io.maxi.core.MaxiParseResult;
import io.maxi.core.MaxiRecord;
import io.maxi.core.MaxiSchema;
import io.maxi.core.MaxiTypeDef;
import io.maxi.core.ParseOptions;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sports Statistics API CLI client — Java.
 *
 * <p>Calls every server endpoint and prints the raw MAXI wire body alongside
 * a human-readable summary. Mirrors {@code client-go}, {@code client-py},
 * {@code client-js}, and {@code client-php}.
 *
 * <p>Usage:
 * <pre>
 *   BASE_URL=http://localhost:8055 java -jar client-java.jar
 * </pre>
 */
public class ClientApp {

    private static final String HR =
        "────────────────────────────────────────────────────────────";

    private static final Maxi maxi = new Maxi();

    private static String baseUrl;
    private static String sharedDir;
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    public static void main(String[] args) throws Exception {
        baseUrl   = System.getenv().getOrDefault("BASE_URL", "http://localhost:8055").stripTrailing();
        sharedDir = resolveSharedDir();

        // ── 1. GET /players ───────────────────────────────────────────────
        section("GET /players  (raw parse → positional values)");
        String text = httpGet("/players");
        MaxiParseResult res = parse(text);
        List<List<String>> playerRows = new ArrayList<>();
        for (MaxiRecord rec : res.getRecords()) {
            if ("P".equals(rec.alias())) {
                var v = rec.values();
                playerRows.add(List.of(s(v,0), s(v,1), s(v,2), s(v,3), s(v,4)));
            }
        }
        printTable(List.of("id","name","position","birthYear","team"), playerRows);

        // ── 2. GET /teams ─────────────────────────────────────────────────
        section("GET /teams");
        text = httpGet("/teams");
        List<Team> fetchedTeams = maxi.parseAs(text, Team.class, parseOpts()).getAs("T", Team.class);
        List<List<String>> teamRows = new ArrayList<>();
        for (Team t : fetchedTeams) {
            teamRows.add(List.of(String.valueOf(t.id), t.name, t.city, String.valueOf(t.founded), t.coach));
        }
        printTable(List.of("id","name","city","founded","coach"), teamRows);

        // ── 3. GET /teams/1 ───────────────────────────────────────────────
        section("GET /teams/1  (team + roster)");
        text = httpGet("/teams/1");
        res  = parse(text);
        List<String> typeNames = res.getSchema().types().stream()
            .map(MaxiTypeDef::getAlias).toList();
        System.out.printf("  Schema types in response: %s%n", String.join(", ", typeNames));
        for (MaxiRecord rec : res.getRecords()) {
            List<String> vals = rec.values().stream().map(ClientApp::anyStr).toList();
            System.out.printf("  %s(%s)%n", rec.alias(), String.join(" | ", vals));
        }

        // ── 4. GET /games ─────────────────────────────────────────────────
        section("GET /games");
        text = httpGet("/games");
        res  = parse(text);
        List<List<String>> gameRows = new ArrayList<>();
        var gameReg = buildRegistry(res);
        for (MaxiRecord rec : res.getRecords()) {
            if ("G".equals(rec.alias()) && rec.values().size() >= 7) {
                var v = rec.values();
                String home  = strOrRef(v.get(1), "T", gameReg, "name");
                String away  = strOrRef(v.get(2), "T", gameReg, "name");
                String score = s(v,5) + "\u2013" + s(v,6);
                gameRows.add(List.of(s(v,0), home, away, s(v,3), s(v,4), score));
            }
        }
        printTable(List.of("id","home","away","date","status","score"), gameRows);

        // ── 5. GET /games/1 ───────────────────────────────────────────────
        section("GET /games/1  (GameDetail with nested S[] arrays)");
        text = httpGet("/games/1");
        res  = parse(text);
        var gameDetailReg = buildRegistry(res);
        for (MaxiRecord rec : res.getRecords()) {
            if ("D".equals(rec.alias()) && rec.values().size() >= 3) {
                var v = rec.values();
                System.out.printf("  GameDetail for game %s:%n", s(v,0));
                System.out.println("  Home:");
                printTable(List.of("name","goals","assists","minutes"), toStatRows(v.get(1), gameDetailReg));
                System.out.println("  Away:");
                printTable(List.of("name","goals","assists","minutes"), toStatRows(v.get(2), gameDetailReg));
            }
        }

        // ── 6. GET /transfers ─────────────────────────────────────────────
        section("GET /transfers  (object references → resolve via ObjectRegistry)");
        text = httpGet("/transfers");
        res  = parse(text);
        var reg = buildRegistry(res);
        System.out.println("\n  Hydrated Transfer records (player/team resolved from ObjectRegistry):");
        for (MaxiRecord rec : res.getRecords()) {
            if ("X".equals(rec.alias()) && rec.values().size() >= 6) {
                var v = rec.values();
                String pName = strOrRef(v.get(1), "P", reg, "name");
                String fName = strOrRef(v.get(2), "T", reg, "name");
                String tName = strOrRef(v.get(3), "T", reg, "name");
                System.out.printf("  Transfer(#%s | %s | %s → %s | %s | %s)%n",
                    s(v,0), pName, fName, tName, s(v,4), feeStr(v.get(5)));
            }
        }
        // show one resolved reference
        var regSnapshot = reg;
        res.getRecords().stream().filter(r -> "X".equals(r.alias())).findFirst().ifPresent(r -> {
            var resolved = resolveRef(r.values().get(1), "P", regSnapshot);
            System.out.printf("%n  ✓ player resolved to full dict: %b%n", resolved != null);
            if (resolved != null) System.out.printf("    player['name'] = %s%n", resolved.get("name"));
        });

        // ── 7. GET /players/3/transfers ───────────────────────────────────
        section("GET /players/3/transfers  (player transfer history)");
        text = httpGet("/players/3/transfers");
        res  = parse(text);
        reg  = buildRegistry(res);
        for (MaxiRecord rec : res.getRecords()) {
            if ("X".equals(rec.alias()) && rec.values().size() >= 6) {
                var v = rec.values();
                String pName = strOrRef(v.get(1), "P", reg, "name");
                String fName = strOrRef(v.get(2), "T", reg, "name");
                String tName = strOrRef(v.get(3), "T", reg, "name");
                System.out.printf("  Transfer(#%s | %s | %s → %s | %s | %s)%n",
                    s(v,0), pName, fName, tName, s(v,4), feeStr(v.get(5)));
            }
        }

        // ── 8. POST /players ──────────────────────────────────────────────
        section("POST /players  (MAXI request body → MAXI response)");
        Team thunderFC  = fetchedTeams.isEmpty() ? new Team() : fetchedTeams.get(0);
        Player newPlayer = new Player();
        newPlayer.name      = "Luca Bianchi";
        newPlayer.position  = "forward";
        newPlayer.birthYear = 2001;
        newPlayer.team      = thunderFC;
        String reqBody = maxi.dumpAuto(List.of(newPlayer),
            DumpOptions.defaults().setSchemaFile("sports.mxs").setIncludeTypes(false));
        String respText = httpPost("/players", reqBody);
        MaxiParseResult postRes = parse(respText);
        var postReg = buildRegistry(postRes);
        MaxiRecord postRec = postRes.getRecords().stream()
            .filter(r -> "P".equals(r.alias())).findFirst().orElse(null);
        if (postRec != null) {
            var v = postRec.values();
            int createdId   = Integer.parseInt(s(v, 0));
            String cName    = s(v, 1);
            String cPos     = s(v, 2);
            int cYear       = Integer.parseInt(s(v, 3).isEmpty() ? "0" : s(v, 3));
            String cTeamStr = strOrRef(v.get(4), "T", postReg, "name");
            System.out.printf("%n  ✓ Created: Player(%d | %s | %s | %d | %s)%n",
                createdId, cName, cPos, cYear, cTeamStr);

            // ── 9. PUT /players/:id ───────────────────────────────────────
            section(String.format("PUT /players/%d  (update just-created player)", createdId));
            Player updated = new Player();
            updated.id        = createdId;
            updated.name      = cName;
            updated.position  = "midfielder";
            updated.birthYear = cYear;
            updated.team      = thunderFC;
            String putBody = maxi.dumpAuto(List.of(updated),
                DumpOptions.defaults().setSchemaFile("sports.mxs").setIncludeTypes(false));
            respText = httpPut("/players/" + createdId, putBody);
            MaxiParseResult putRes = parse(respText);
            var putReg = buildRegistry(putRes);
            MaxiRecord putRec = putRes.getRecords().stream()
                .filter(r -> "P".equals(r.alias())).findFirst().orElse(null);
            if (putRec != null) {
                var pv = putRec.values();
                System.out.printf("%n  ✓ Updated: Player(%s | %s | %s | %s | %s)%n",
                    s(pv,0), s(pv,1), s(pv,2), s(pv,3),
                    strOrRef(pv.get(4), "T", putReg, "name"));
                System.out.printf("  ✓ position updated to: %s%n", s(pv, 2));
            }

            // ── 10. DELETE /players/:id ───────────────────────────────────
            section(String.format("DELETE /players/%d  (clean up demo player)", createdId));
            httpDelete("/players/" + createdId);
            System.out.println("\n  ✓ Demo player removed — data is clean for the next run.");
        }

        System.out.printf("%n%s%n  All endpoints validated successfully.%n%s%n%n", HR, HR);
    }

    private static String httpGet(String path) throws Exception {
        System.out.printf("  → GET %s%s%n", baseUrl, path);
        var req = HttpRequest.newBuilder(URI.create(baseUrl + path)).GET().build();
        var resp = HTTP.send(req, BodyHandlers.ofString());
        System.out.printf("  ← HTTP %d%n", resp.statusCode());
        printRaw(resp.body(), "response");
        if (resp.statusCode() >= 400) throw new RuntimeException("GET " + path + " → HTTP " + resp.statusCode());
        return resp.body();
    }

    private static String httpPost(String path, String body) throws Exception {
        System.out.printf("  → POST %s%s%n", baseUrl, path);
        printRaw(body, "request");
        var req = HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Content-Type", "application/maxi")
            .POST(BodyPublishers.ofString(body)).build();
        var resp = HTTP.send(req, BodyHandlers.ofString());
        System.out.printf("  ← HTTP %d%n", resp.statusCode());
        printRaw(resp.body(), "response");
        if (resp.statusCode() >= 400) throw new RuntimeException("POST " + path + " → HTTP " + resp.statusCode());
        return resp.body();
    }

    private static String httpPut(String path, String body) throws Exception {
        System.out.printf("  → PUT %s%s%n", baseUrl, path);
        printRaw(body, "request");
        var req = HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Content-Type", "application/maxi")
            .PUT(BodyPublishers.ofString(body)).build();
        var resp = HTTP.send(req, BodyHandlers.ofString());
        System.out.printf("  ← HTTP %d%n", resp.statusCode());
        printRaw(resp.body(), "response");
        if (resp.statusCode() >= 400) throw new RuntimeException("PUT " + path + " → HTTP " + resp.statusCode());
        return resp.body();
    }

    private static void httpDelete(String path) throws Exception {
        System.out.printf("  → DELETE %s%s%n", baseUrl, path);
        var req = HttpRequest.newBuilder(URI.create(baseUrl + path))
            .DELETE().build();
        var resp = HTTP.send(req, BodyHandlers.ofString());
        System.out.printf("  ← HTTP %d%n", resp.statusCode());
    }

    private static ParseOptions parseOpts() {
        return ParseOptions.defaults()
            .setSchemaLoader(name -> {
                String safe = name.replaceAll("[^a-zA-Z0-9._-]", "");
                try {
                    return Files.readString(Path.of(sharedDir, safe));
                } catch (java.io.IOException e) {
                    throw new RuntimeException("Cannot load schema: " + name, e);
                }
            });
    }

    private static MaxiParseResult parse(String text) throws MaxiParseException {
        return maxi.parse(text, parseOpts());
    }

    private static Map<String, Map<String, Map<String, Object>>> buildRegistry(MaxiParseResult res) {
        // alias → id-string → object map
        Map<String, Map<String, Map<String, Object>>> reg = new HashMap<>();
        MaxiSchema schema = res.getSchema();
        for (MaxiRecord rec : res.getRecords()) {
            MaxiTypeDef td = schema.getType(rec.alias());
            if (td == null) continue;
            int idIdx = td.idFieldIndex();
            if (idIdx < 0 || idIdx >= rec.values().size()) continue;
            Object idVal = rec.values().get(idIdx);
            if (idVal == null) continue;
            Map<String, Object> obj = new LinkedHashMap<>();
            for (int i = 0; i < td.getFields().size() && i < rec.values().size(); i++) {
                obj.put(td.getFields().get(i).getName(), rec.values().get(i));
            }
            reg.computeIfAbsent(rec.alias(), k -> new LinkedHashMap<>())
               .put(String.valueOf(idVal), obj);
        }
        return reg;
    }

    private static Map<String, Object> resolveRef(Object val, String alias,
            Map<String, Map<String, Map<String, Object>>> reg) {
        if (val == null || reg == null) return null;
        var aliasReg = reg.get(alias);
        return aliasReg != null ? aliasReg.get(String.valueOf(val)) : null;
    }

    private static String strOrRef(Object val, String alias,
            Map<String, Map<String, Map<String, Object>>> reg, String field) {
        Map<String, Object> obj = resolveRef(val, alias, reg);
        if (obj != null && obj.get(field) != null) return String.valueOf(obj.get(field));
        return "#" + val;
    }

    // ── Display helpers ───────────────────────────────────────────────────

    private static void section(String title) {
        System.out.printf("%n%s%n  %s%n%s%n", HR, title, HR);
    }

    private static void printRaw(String text, String direction) {
        String label = "request".equals(direction) ? "MAXI body (request)" : "MAXI body (response)";
        System.out.printf("  ┌─ %s%n", label);
        for (String line : text.stripTrailing().split("\n", -1)) {
            System.out.printf("  │ %s%n", line);
        }
        System.out.println("  └─");
    }

    private static void printTable(List<String> headers, List<List<String>> rows) {
        if (rows.isEmpty()) { System.out.println("  (no records)"); return; }
        int[] widths = new int[headers.size()];
        for (int i = 0; i < headers.size(); i++) widths[i] = headers.get(i).length();
        for (List<String> row : rows) {
            for (int i = 0; i < row.size() && i < widths.length; i++) {
                widths[i] = Math.max(widths[i], row.get(i).length());
            }
        }
        System.out.println("  " + fmtRow(headers, widths));
        StringBuilder div = new StringBuilder("  ");
        for (int i = 0; i < widths.length; i++) {
            if (i > 0) div.append("  ");
            div.append("─".repeat(widths[i]));
        }
        System.out.println(div);
        for (List<String> row : rows) System.out.println("  " + fmtRow(row, widths));
    }

    private static String fmtRow(List<String> cells, int[] widths) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < widths.length; i++) {
            if (i > 0) sb.append("  ");
            String v = i < cells.size() ? cells.get(i) : "";
            sb.append(v);
            sb.append(" ".repeat(Math.max(0, widths[i] - v.length())));
        }
        return sb.toString();
    }

    // ── Value helpers ─────────────────────────────────────────────────────

    private static String s(List<Object> vals, int i) {
        if (i >= vals.size() || vals.get(i) == null) return "";
        return String.valueOf(vals.get(i));
    }

    private static String anyStr(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static String feeStr(Object v) {
        if (v == null) return "free";
        try {
            double d = Double.parseDouble(String.valueOf(v));
            return "€" + (long) d;
        } catch (NumberFormatException e) { return String.valueOf(v); }
    }

    @SuppressWarnings("unchecked")
    private static List<List<String>> toStatRows(Object arr,
            Map<String, Map<String, Map<String, Object>>> reg) {
        if (!(arr instanceof List<?> list)) return List.of();
        var rows = new java.util.ArrayList<List<String>>();
        for (var item : list) {
            if (!(item instanceof Map<?, ?> raw)) continue;
            var s = (Map<String, Object>) raw;
            Map<String, Object> p = resolveRef(s.get("player"), "P", reg);
            String name = p != null ? String.valueOf(p.get("name")) : "#" + s.get("player");
            rows.add(List.of(name, anyStr(s.get("goals")),
                    anyStr(s.get("assists")), anyStr(s.get("minutesPlayed"))));
        }
        return rows;
    }

    // ── Schema dir ────────────────────────────────────────────────────────

    private static String resolveSharedDir() {
        Path docker = Path.of("/app/shared");
        if (Files.isDirectory(docker)) return docker.toString();
        return "../shared";
    }

}
