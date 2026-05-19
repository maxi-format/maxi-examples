package io.maxi.examples.server;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory data store for the Sports Statistics API.
 *
 * <p>JSON seed files are read once at startup via {@link PostConstruct}.
 * POST/PUT/DELETE mutate only the in-memory lists; the seed files on disk
 * are never written, so the server always starts clean.
 */
@ApplicationScoped
public class DataLoader {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> LIST_TYPE =
            new TypeReference<>() {};

    private List<Map<String, Object>> players;
    private List<Map<String, Object>> teams;
    private List<Map<String, Object>> games;
    private List<Map<String, Object>> gameStats;
    private List<Map<String, Object>> transfers;
    private String sharedDir;

    @PostConstruct
    void init() {
        sharedDir = resolveSharedDir();
        String dataDir = sharedDir + "/data";
        try {
            players   = load(dataDir, "players.json");
            teams     = load(dataDir, "teams.json");
            games     = load(dataDir, "games.json");
            gameStats = load(dataDir, "game_stats.json");
            transfers = load(dataDir, "transfers.json");
        } catch (IOException e) {
            throw new RuntimeException("Failed to load seed data from: " + dataDir, e);
        }
    }

    public String getSharedDir() { return sharedDir; }

    private static String resolveSharedDir() {
        Path docker = Path.of("/app/shared");
        return Files.isDirectory(docker) ? docker.toString() : "../shared";
    }

    private static List<Map<String, Object>> load(String dir, String file) throws IOException {
        return new CopyOnWriteArrayList<>(
            MAPPER.readValue(Path.of(dir, file).toFile(), LIST_TYPE)
        );
    }

    // ── Players ──────────────────────────────────────────────────────────

    public List<Map<String, Object>> getPlayers() {
        return List.copyOf(players);
    }

    public Map<String, Object> findPlayer(int id) {
        return players.stream().filter(p -> intOf(p.get("id")) == id).findFirst().orElse(null);
    }

    public int nextPlayerId() {
        return players.stream().mapToInt(p -> intOf(p.get("id"))).max().orElse(0) + 1;
    }

    public void addPlayer(Map<String, Object> player) {
        players.add(new LinkedHashMap<>(player));
    }

    public boolean updatePlayer(int id, Map<String, Object> updated) {
        for (int i = 0; i < players.size(); i++) {
            if (intOf(players.get(i).get("id")) == id) {
                players.set(i, new LinkedHashMap<>(updated));
                return true;
            }
        }
        return false;
    }

    public boolean deletePlayer(int id) {
        return players.removeIf(p -> intOf(p.get("id")) == id);
    }

    public List<Map<String, Object>> getPlayersForTeam(int teamId) {
        return players.stream().filter(p -> intOf(p.get("teamId")) == teamId).toList();
    }

    // ── Teams ─────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getTeams() {
        return List.copyOf(teams);
    }

    public Map<String, Object> findTeam(int id) {
        return teams.stream().filter(t -> intOf(t.get("id")) == id).findFirst().orElse(null);
    }

    // ── Games ─────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getGames() {
        return List.copyOf(games);
    }

    public Map<String, Object> findGame(int id) {
        return games.stream().filter(g -> intOf(g.get("id")) == id).findFirst().orElse(null);
    }

    public Map<String, Object> findGameStats(int gameId) {
        return gameStats.stream().filter(s -> intOf(s.get("gameId")) == gameId).findFirst().orElse(null);
    }

    // ── Transfers ─────────────────────────────────────────────────────────

    /**
     * Returns transfers with full player and team objects inlined.
     * If {@code playerId > 0}, only transfers for that player are returned.
     */
    public List<Map<String, Object>> getTransfersForPlayer(int playerId) {
        Map<Integer, Map<String, Object>> playerMap = new HashMap<>();
        for (Map<String, Object> p : players) playerMap.put(intOf(p.get("id")), p);

        Map<Integer, Map<String, Object>> teamMap = new HashMap<>();
        for (Map<String, Object> t : teams) teamMap.put(intOf(t.get("id")), t);

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> t : transfers) {
            int pid = intOf(t.get("playerId"));
            if (playerId > 0 && pid != playerId) continue;

            Map<String, Object> p  = playerMap.get(pid);
            Map<String, Object> ft = teamMap.get(intOf(t.get("fromTeamId")));
            Map<String, Object> tt = teamMap.get(intOf(t.get("toTeamId")));
            if (p == null || ft == null || tt == null) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id",       t.get("id"));
            row.put("player",   p);
            row.put("fromTeam", ft);
            row.put("toTeam",   tt);
            row.put("date",     t.get("date"));
            row.put("fee",      t.get("fee"));
            out.add(row);
        }
        return out;
    }

    // ── Helper ────────────────────────────────────────────────────────────

    static int intOf(Object v) {
        if (v instanceof Number n) return n.intValue();
        return 0;
    }
}
