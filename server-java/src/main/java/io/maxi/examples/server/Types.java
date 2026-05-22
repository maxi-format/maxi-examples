package io.maxi.examples.server;

import io.maxi.api.SchemaRegistry;
import io.maxi.core.MaxiTypeDef;
import io.maxi.examples.server.model.Game;
import io.maxi.examples.server.model.GameDetail;
import io.maxi.examples.server.model.Player;
import io.maxi.examples.server.model.PlayerStats;
import io.maxi.examples.server.model.Team;
import io.maxi.examples.server.model.Transfer;

/**
 * MAXI type definitions that mirror {@code shared/sports.mxs}.
 *
 * <p>Each constant is now derived from the corresponding annotated model class
 * ({@code @MaxiType}/{@code @MaxiField}) via {@link SchemaRegistry#buildTypeDef},
 * replacing the previous hand-written {@link MaxiTypeDef} construction.
 * {@link ServerApp} continues to use these constants unchanged.
 */
final class Types {

    private static final SchemaRegistry REG = SchemaRegistry.create()
            .register(Player.class)
            .register(Team.class)
            .register(PlayerStats.class)
            .register(Game.class)
            .register(GameDetail.class)
            .register(Transfer.class);

    static final MaxiTypeDef PLAYER       = REG.getForAlias("P");
    static final MaxiTypeDef TEAM         = REG.getForAlias("T");
    static final MaxiTypeDef PLAYER_STATS = REG.getForAlias("S");
    static final MaxiTypeDef GAME         = REG.getForAlias("G");
    static final MaxiTypeDef GAME_DETAIL  = REG.getForAlias("D");
    static final MaxiTypeDef TRANSFER     = REG.getForAlias("X");

    private Types() {}
}
