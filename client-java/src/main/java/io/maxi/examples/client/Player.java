package io.maxi.examples.client;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * Player DTO — mirrors the P:Player type in shared/sports.mxs.
 * Annotated with {@link MaxiType}/{@link MaxiField} so that
 * {@link io.maxi.api.SchemaRegistry#buildTypeDef} can derive the MAXI
 * schema from the class instead of the hand-written builder method.
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
