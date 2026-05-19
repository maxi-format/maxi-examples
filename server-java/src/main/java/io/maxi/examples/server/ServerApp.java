package io.maxi.examples.server;

import io.maxi.api.Maxi;
import io.maxi.core.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.nio.file.Files;
import java.util.*;

/**
 * Sports Statistics API — Java / Quarkus server.
 *
 * <p>Mirrors the endpoints of {@code server-go}, {@code server-py},
 * {@code server-js}, and {@code server-php}.
 *
 * <p>Wire format: {@code application/maxi}.
 */
@Path("/")
@ApplicationScoped
@Produces("application/maxi")
public class ServerApp {

    @Inject
    DataLoader data;

    @GET
    @Path("/schema/{name}")
    @Produces("text/plain;charset=utf-8")
    public Response getSchema(@PathParam("name") String name) throws Exception {
        String safe = sanitize(name);
        java.nio.file.Path p = java.nio.file.Path.of(data.getSharedDir(), safe);
        if (!Files.exists(p)) return Response.status(404).build();
        return Response.ok(Files.readString(p)).build();
    }

    @GET
    @Path("/players")
    public Response getPlayers() {
        return ok("P", List.of(Types.PLAYER), data.getPlayers());
    }

    @GET
    @Path("/players/{id}")
    public Response getPlayer(@PathParam("id") int id) {
        var p = data.findPlayer(id);
        if (p == null) return Response.status(404).build();
        return ok("P", List.of(Types.PLAYER), List.of(p));
    }

    @POST
    @Path("/players")
    @Consumes("application/maxi")
    public Response createPlayer(String body) {
        var parsed = parseBody(body);
        if (parsed == null || parsed.getRecords().isEmpty())
            return Response.status(400).entity("invalid body").build();
        var v = parsed.getRecords().get(0).values();
        int newId = data.nextPlayerId();
        Map<String, Object> player = new LinkedHashMap<>();
        player.put("id",        newId);
        player.put("name",      strVal(v, 1));
        player.put("position",  strVal(v, 2));
        player.put("birthYear", intVal(v, 3));
        player.put("teamId",    intVal(v, 4));
        data.addPlayer(player);
        return Response.status(201)
            .type("application/maxi")
            .entity(dump("P", List.of(Types.PLAYER), List.of(player)))
            .build();
    }

    @PUT
    @Path("/players/{id}")
    @Consumes("application/maxi")
    public Response updatePlayer(@PathParam("id") int id, String body) {
        var parsed = parseBody(body);
        if (parsed == null || parsed.getRecords().isEmpty())
            return Response.status(400).entity("invalid body").build();
        var v = parsed.getRecords().get(0).values();
        Map<String, Object> player = new LinkedHashMap<>();
        player.put("id",        id);
        player.put("name",      strVal(v, 1));
        player.put("position",  strVal(v, 2));
        player.put("birthYear", intVal(v, 3));
        player.put("teamId",    intVal(v, 4));
        if (!data.updatePlayer(id, player)) return Response.status(404).build();
        return ok("P", List.of(Types.PLAYER), List.of(player));
    }

    @DELETE
    @Path("/players/{id}")
    public Response deletePlayer(@PathParam("id") int id) {
        if (!data.deletePlayer(id)) return Response.status(404).build();
        return Response.noContent().build();
    }

    @GET
    @Path("/players/{id}/transfers")
    public Response getPlayerTransfers(@PathParam("id") int id) {
        var rows = data.getTransfersForPlayer(id);
        if (rows.isEmpty()) return Response.status(404).build();
        return okMulti(List.of(Types.PLAYER, Types.TEAM, Types.TRANSFER),
            Map.of("X", rows));
    }

    @GET
    @Path("/teams")
    public Response getTeams() {
        return ok("T", List.of(Types.TEAM), data.getTeams());
    }

    @GET
    @Path("/teams/{id}")
    public Response getTeam(@PathParam("id") int id) {
        var team = data.findTeam(id);
        if (team == null) return Response.status(404).build();
        var roster = data.getPlayersForTeam(id);
        return okMulti(List.of(Types.TEAM, Types.PLAYER),
            Map.of("T", List.of(team), "P", roster));
    }

    @GET
    @Path("/games")
    public Response getGames() {
        return ok("G", List.of(Types.GAME), data.getGames());
    }

    @GET
    @Path("/games/{id}")
    public Response getGame(@PathParam("id") int id) {
        var game = data.findGame(id);
        if (game == null) return Response.status(404).build();
        var stats = data.findGameStats(id);
        if (stats != null) {
            return okMulti(List.of(Types.GAME, Types.PLAYER_STATS, Types.GAME_DETAIL),
                Map.of("G", List.of(game), "D", List.of(stats)));
        }
        return ok("G", List.of(Types.GAME), List.of(game));
    }

    @GET
    @Path("/transfers")
    public Response getTransfers() {
        return okMulti(List.of(Types.PLAYER, Types.TEAM, Types.TRANSFER),
            Map.of("X", data.getTransfersForPlayer(0)));
    }

    private Response ok(String alias, List<MaxiTypeDef> types,
            List<Map<String, Object>> rows) {
        return Response.ok(dump(alias, types, rows)).build();
    }

    private Response okMulti(List<MaxiTypeDef> types,
            Map<String, List<Map<String, Object>>> rowsByAlias) {
        return Response.ok(dumpMulti(types, rowsByAlias)).build();
    }

    private String dump(String alias, List<MaxiTypeDef> types,
            List<Map<String, Object>> rows) {
        return dumpMulti(types, Map.of(alias, rows));
    }

    private String dumpMulti(List<MaxiTypeDef> types,
            Map<String, List<Map<String, Object>>> rowsByAlias) {
        var opts = DumpOptions.defaults()
            .setSchemaFile("sports.mxs")
            .setIncludeTypes(false)
            .setCollectReferences(true)
            .setTypes(types);
        return Maxi.dumpFromMaps(rowsByAlias, types, opts);
    }

    private MaxiParseResult parseBody(String body) {
        try {
            ParseOptions opts = ParseOptions.defaults()
                .setSchemaLoader(name -> {
                    String safe = sanitize(name);
                    try {
                        return Files.readString(java.nio.file.Path.of(data.getSharedDir(), safe));
                    } catch (java.io.IOException e) {
                        throw new RuntimeException("Cannot load schema: " + name, e);
                    }
                });
            return Maxi.parse(body, opts);
        } catch (Exception e) {
            return null;
        }
    }

    private static String sanitize(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "");
    }

    private static String strVal(List<Object> vals, int i) {
        if (i >= vals.size() || vals.get(i) == null) return "";
        return String.valueOf(vals.get(i));
    }

    private static int intVal(List<Object> vals, int i) {
        if (i >= vals.size() || vals.get(i) == null) return 0;
        Object v = vals.get(i);
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString().strip()); } catch (Exception e) { return 0; }
    }
}