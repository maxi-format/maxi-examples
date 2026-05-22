package io.maxi.examples.client;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * PlayerStats DTO — mirrors the S:PlayerStats type in shared/sports.mxs.
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
