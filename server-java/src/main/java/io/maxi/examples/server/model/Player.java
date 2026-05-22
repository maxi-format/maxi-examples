package io.maxi.examples.server.model;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * Player DTO — mirrors the P:Player type in shared/sports.mxs.
 * Annotated with {@link MaxiType}/{@link MaxiField} so that
 * {@link io.maxi.api.SchemaRegistry} derives the MAXI schema from the
 * class instead of hand-written {@code MaxiTypeDef} objects.
 */
@MaxiType(alias = "P", name = "Player")
public class Player {

    @MaxiField(typeExpr = "int")
    public int id;

    @MaxiField(required = true)
    public String name;

    @MaxiField(typeExpr = "enum[forward,midfielder,defender,goalkeeper]")
    public String position;

    @MaxiField(typeExpr = "int")
    public int birthYear;

    @MaxiField(typeExpr = "T")
    public Team team;

    public Player() {}
}
