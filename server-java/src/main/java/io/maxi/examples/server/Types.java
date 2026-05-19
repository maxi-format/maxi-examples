package io.maxi.examples.server;

import io.maxi.core.MaxiTypeDef;
import io.maxi.core.MaxiFieldDef;
import io.maxi.core.ParsedConstraint;
import io.maxi.core.ConstraintType;

import java.util.List;

/**
 * MAXI type definitions that mirror {@code shared/sports.mxs}.
 * Used to serialise records via the dumper without re-parsing the schema file.
 */
final class Types {

    private Types() {}

    // P:Player(id:int|name(!)|position:enum[forward,midfielder,defender,goalkeeper]|birthYear:int|teamId:int)
    static final MaxiTypeDef PLAYER = type("P", "Player",
        field("id",        "int",  false),
        required("name"),
        field("position",  "enum[forward,midfielder,defender,goalkeeper]", false),
        field("birthYear", "int",  false),
        field("teamId",    "int",  false)
    );

    // T:Team(id:int|name(!)|city(!)|founded:int|coach(!))
    static final MaxiTypeDef TEAM = type("T", "Team",
        field("id",      "int",  false),
        required("name"),
        required("city"),
        field("founded", "int",  false),
        required("coach")
    );

    // S:PlayerStats(playerId:int|goals:int=0|assists:int=0|minutesPlayed:int=0)
    static final MaxiTypeDef PLAYER_STATS = type("S", "PlayerStats",
        field("playerId",      "int", false),
        defaultField("goals",        "int", 0),
        defaultField("assists",      "int", 0),
        defaultField("minutesPlayed","int", 0)
    );

    // G:Game(id:int|homeTeamId:int|awayTeamId:int|date:str@date(!)|status:enum[...]|homeScore:int=0|awayScore:int=0)
    static final MaxiTypeDef GAME = type("G", "Game",
        field("id",          "int",  false),
        field("homeTeamId",  "int",  false),
        field("awayTeamId",  "int",  false),
        annotatedRequired("date", "str", "date"),
        field("status",      "enum[scheduled,live,finished,cancelled]", false),
        defaultField("homeScore", "int", 0),
        defaultField("awayScore", "int", 0)
    );

    // D:GameDetail(gameId:int|homePlayers:S[]|awayPlayers:S[])
    static final MaxiTypeDef GAME_DETAIL = type("D", "GameDetail",
        field("gameId",      "int", false),
        field("homePlayers", "S[]", false),
        field("awayPlayers", "S[]", false)
    );

    // X:Transfer(id:int|player:P|fromTeam:T|toTeam:T|date:str@date(!)|fee:decimal)
    static final MaxiTypeDef TRANSFER = type("X", "Transfer",
        field("id",       "int",     false),
        field("player",   "P",       false),
        field("fromTeam", "T",       false),
        field("toTeam",   "T",       false),
        annotatedRequired("date", "str", "date"),
        field("fee",      "decimal", false)
    );

    // ── Builders ──────────────────────────────────────────────────────────

    private static MaxiTypeDef type(String alias, String name, MaxiFieldDef... fields) {
        MaxiTypeDef td = new MaxiTypeDef(alias, name);
        for (MaxiFieldDef f : fields) td.addField(f);
        return td;
    }

    private static MaxiFieldDef field(String name, String typeExpr, boolean req) {
        MaxiFieldDef f = new MaxiFieldDef(name);
        if (typeExpr != null && !typeExpr.isEmpty()) f.setTypeExpr(typeExpr);
        if (req) f.addConstraint(new ParsedConstraint(ConstraintType.REQUIRED, null, null));
        return f;
    }

    private static MaxiFieldDef required(String name) {
        MaxiFieldDef f = new MaxiFieldDef(name);
        f.addConstraint(new ParsedConstraint(ConstraintType.REQUIRED, null, null));
        return f;
    }

    private static MaxiFieldDef defaultField(String name, String typeExpr, Object defaultValue) {
        MaxiFieldDef f = new MaxiFieldDef(name);
        if (typeExpr != null && !typeExpr.isEmpty()) f.setTypeExpr(typeExpr);
        f.setDefaultValue(defaultValue);
        return f;
    }

    private static MaxiFieldDef annotatedRequired(String name, String typeExpr, String annotation) {
        MaxiFieldDef f = new MaxiFieldDef(name);
        if (typeExpr != null && !typeExpr.isEmpty()) f.setTypeExpr(typeExpr);
        if (annotation != null && !annotation.isEmpty()) f.setAnnotation(annotation);
        f.addConstraint(new ParsedConstraint(ConstraintType.REQUIRED, null, null));
        return f;
    }
}
