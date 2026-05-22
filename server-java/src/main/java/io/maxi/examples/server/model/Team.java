package io.maxi.examples.server.model;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * Team DTO — mirrors the T:Team type in shared/sports.mxs.
 */
@MaxiType(alias = "T", name = "Team")
public class Team {

    @MaxiField(typeExpr = "int")
    public int id;

    @MaxiField(required = true)
    public String name;

    @MaxiField(required = true)
    public String city;

    @MaxiField(typeExpr = "int")
    public int founded;

    @MaxiField(required = true)
    public String coach;

    public Team() {}
}
