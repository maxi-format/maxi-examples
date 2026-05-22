package io.maxi.examples.client;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * Transfer DTO — mirrors the X:Transfer type in shared/sports.mxs.
 * player, fromTeam, toTeam are object references resolved from the record pool.
 */
@MaxiType(alias = "X", name = "Transfer")
public class Transfer {

    @MaxiField(typeExpr = "int")
    public int id;

    @MaxiField(typeExpr = "P")
    public Player player;

    @MaxiField(typeExpr = "T")
    public Team fromTeam;

    @MaxiField(typeExpr = "T")
    public Team toTeam;

    @MaxiField(annotation = "date", required = true)
    public String date;

    @MaxiField(typeExpr = "decimal")
    public Double fee;

    public Transfer() {}
}
