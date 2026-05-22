package io.maxi.examples.server.model;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * Game DTO — mirrors the G:Game type in shared/sports.mxs.
 * Scores default to 0 in both Java and the MAXI schema.
 */
@MaxiType(alias = "G", name = "Game")
public class Game {

    @MaxiField(typeExpr = "int")
    public int id;

    @MaxiField(typeExpr = "T")
    public Team homeTeam;

    @MaxiField(typeExpr = "T")
    public Team awayTeam;

    @MaxiField(annotation = "date", required = true)
    public String date;

    @MaxiField(typeExpr = "enum[scheduled,live,finished,cancelled]")
    public String status;

    @MaxiField(typeExpr = "int", defaultValue = "0")
    public int homeScore;

    @MaxiField(typeExpr = "int", defaultValue = "0")
    public int awayScore;

    public Game() {}
}
