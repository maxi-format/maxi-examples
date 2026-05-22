package io.maxi.examples.client;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

import java.util.List;

/**
 * GameDetail DTO — mirrors the D:GameDetail type in shared/sports.mxs.
 */
@MaxiType(alias = "D", name = "GameDetail")
public class GameDetail {

    @MaxiField(typeExpr = "int")
    public int gameId;

    @MaxiField(typeExpr = "S[]")
    public List<PlayerStats> homePlayers;

    @MaxiField(typeExpr = "S[]")
    public List<PlayerStats> awayPlayers;

    public GameDetail() {}
}
