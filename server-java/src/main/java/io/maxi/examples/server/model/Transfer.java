package io.maxi.examples.server.model;

import io.maxi.annotation.MaxiField;
import io.maxi.annotation.MaxiType;

/**
 * Transfer DTO — mirrors the X:Transfer type in shared/sports.mxs.
 *
 * <p>{@code player}, {@code fromTeam}, and {@code toTeam} hold raw object-maps
 * (as returned by {@code DataLoader.getTransfersForPlayer()}) rather than
 * typed {@link Player}/{@link Team} instances. The {@code typeExpr} annotations
 * declare the MAXI reference types so the dumper can collect and emit them as
 * separate P/T records when {@code collectReferences} is enabled.
 */
@MaxiType(alias = "X", name = "Transfer")
public class Transfer {

    @MaxiField(typeExpr = "int")
    public int id;

    @MaxiField(typeExpr = "P")
    public Object player;

    @MaxiField(typeExpr = "T")
    public Object fromTeam;

    @MaxiField(typeExpr = "T")
    public Object toTeam;

    @MaxiField(annotation = "date", required = true)
    public String date;

    @MaxiField(typeExpr = "decimal")
    public Double fee;

    public Transfer() {}
}
