package io.maxi.examples.server.model;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * PlayerStats DTO — mirrors the S:PlayerStats type in shared/sports.mxs.
 * All stat fields default to 0 in both Java and the MAXI schema.
 */
@MaxiType(alias = "S", name = "PlayerStats")
public class PlayerStats {

    @MaxiField(typeExpr = "P")
    public Player player;

    @MaxiField(typeExpr = "int", defaultValue = "0")
    public int goals;

    @MaxiField(typeExpr = "int", defaultValue = "0")
    public int assists;

    @MaxiField(typeExpr = "int", defaultValue = "0")
    public int minutesPlayed;

    public PlayerStats() {}
}
