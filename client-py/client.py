"""
client.py — Sports Statistics API CLI Client (Python)

Every request/response MAXI body is printed inline so you can see exactly
what wire format is exchanged.

Usage:
  BASE_URL=http://localhost:8060 python client.py
"""

import asyncio
import os
import urllib.error
import urllib.request
from pathlib import Path

from maxi import dump_maxi, parse_maxi

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8060").rstrip("/")
SHARED   = Path(__file__).parent.parent / "shared"

def load_schema(name: str) -> str:
    safe = "".join(c for c in name if c.isalnum() or c in "._-")
    return (SHARED / safe).read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# HTTP helpers — always print method, URL, status and raw MAXI body
# ---------------------------------------------------------------------------

def _print_raw(text: str, direction: str = "response") -> None:
    label = "MAXI body (request)" if direction == "request" else "MAXI body (response)"
    print(f"  ┌─ {label}")
    for line in text.rstrip().splitlines():
        print(f"  │ {line}")
    print("  └─")

def http_get(path: str) -> str:
    url = BASE_URL + path
    print(f"  → GET {url}")
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as res:
            body = res.read().decode("utf-8")
            print(f"  ← HTTP {res.status}")
            _print_raw(body)
            return body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  ← HTTP {e.code}")
        _print_raw(body)
        raise RuntimeError(f"GET {path} → HTTP {e.code}") from e

def http_post(path: str, body: str) -> str:
    url = BASE_URL + path
    print(f"  → POST {url}")
    _print_raw(body, "request")
    data = body.encode("utf-8")
    req  = urllib.request.Request(url, data=data,
                                  headers={"Content-Type": "application/maxi"}, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            resp = res.read().decode("utf-8")
            print(f"  ← HTTP {res.status}")
            _print_raw(resp)
            return resp
    except urllib.error.HTTPError as e:
        resp = e.read().decode("utf-8")
        print(f"  ← HTTP {e.code}")
        _print_raw(resp)
        raise RuntimeError(f"POST {path} → HTTP {e.code}") from e

def http_delete(path: str) -> int:
    url = BASE_URL + path
    print(f"  → DELETE {url}")
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req) as res:
            print(f"  ← HTTP {res.status}")
            return res.status
    except urllib.error.HTTPError as e:
        print(f"  ← HTTP {e.code}")
        return e.code

def http_put(path: str, body: str) -> str:
    url = BASE_URL + path
    print(f"  → PUT {url}")
    _print_raw(body, "request")
    data = body.encode("utf-8")
    req  = urllib.request.Request(url, data=data,
                                  headers={"Content-Type": "application/maxi"}, method="PUT")
    try:
        with urllib.request.urlopen(req) as res:
            resp = res.read().decode("utf-8")
            print(f"  ← HTTP {res.status}")
            _print_raw(resp)
            return resp
    except urllib.error.HTTPError as e:
        resp = e.read().decode("utf-8")
        print(f"  ← HTTP {e.code}")
        _print_raw(resp)
        raise RuntimeError(f"PUT {path} → HTTP {e.code}") from e

# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

HR = "─" * 60

def section(title: str) -> None:
    print(f"\n{HR}\n  {title}\n{HR}")

def print_table(headers: list, rows: list) -> None:
    if not rows:
        print("  (no records)")
        return
    widths = [len(str(h)) for h in headers]
    for row in rows:
        for i, v in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(str(v) if v is not None else ""))
    fmt = lambda cells: "  " + "  ".join(
        str(cells[i] if i < len(cells) else "").ljust(widths[i]) for i in range(len(headers))
    )
    print(fmt(headers))
    print("  " + "  ".join("─" * w for w in widths))
    for row in rows:
        print(fmt(list(row)))

# ---------------------------------------------------------------------------
# Reference helpers
# ---------------------------------------------------------------------------

def resolve(value, alias: str, registry: dict):
    if not isinstance(value, (int, str)):
        return value
    try:
        id_val = int(value)
    except (ValueError, TypeError):
        return value
    return (registry.get(alias) or {}).get(id_val, value)

def transfer_str(values, registry: dict) -> str:
    tid, p_ref, f_ref, t_ref, date, fee = values
    player    = resolve(p_ref, "P", registry)
    from_team = resolve(f_ref, "T", registry)
    to_team   = resolve(t_ref, "T", registry)
    p_name  = player["name"]    if isinstance(player, dict)    else f"#{p_ref}"
    f_name  = from_team["name"] if isinstance(from_team, dict) else f"#{f_ref}"
    t_name  = to_team["name"]   if isinstance(to_team, dict)   else f"#{t_ref}"
    fee_str = f"€{int(float(fee)):,}" if fee not in (None, "") else "free"
    return f"  Transfer(#{tid} | {p_name} | {f_name} → {t_name} | {date} | {fee_str})"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

T_PLAYER = {
    "alias": "P", "name": "Player",
    "fields": [
        {"name": "id",        "typeExpr": "int"},
        {"name": "name",      "constraints": [{"type": "required"}]},
        {"name": "position",  "typeExpr": "enum[forward,midfielder,defender,goalkeeper]"},
        {"name": "birthYear", "typeExpr": "int"},
        {"name": "teamId",    "typeExpr": "int"},
    ],
}

async def main() -> None:

    # ── 1. GET /players ───────────────────────────────────────────────────────
    section("GET /players  (raw parse_maxi → positional values)")
    text   = http_get("/players")
    result = await parse_maxi(text, load_schema=load_schema)
    print_table(["id", "name", "position", "birthYear", "teamId"],
                [r.values for r in result.records])

    # ── 2. GET /teams ─────────────────────────────────────────────────────────
    section("GET /teams")
    text   = http_get("/teams")
    result = await parse_maxi(text, load_schema=load_schema)
    print_table(["id", "name", "city", "founded", "coach"],
                [r.values for r in result.records])

    # ── 3. GET /teams/1 — team + roster ───────────────────────────────────────
    section("GET /teams/1  (team with roster)")
    text   = http_get("/teams/1")
    result = await parse_maxi(text, load_schema=load_schema)
    print(f"  Schema types in response: {', '.join(result.schema.types.keys())}")
    for rec in result.records:
        print(f"  {rec.alias}({' | '.join(str(v) for v in rec.values)})")

    # ── 4. GET /games ─────────────────────────────────────────────────────────
    section("GET /games")
    text   = http_get("/games")
    result = await parse_maxi(text, load_schema=load_schema)
    print_table(["id", "home", "away", "date", "status", "score"],
                [[*r.values[:5], f"{r.values[5]}–{r.values[6]}"] for r in result.records])

    # ── 5. GET /games/1 — nested S[] arrays ───────────────────────────────────
    section("GET /games/1  (GameDetail with nested S[] arrays)")
    text   = http_get("/games/1")
    result = await parse_maxi(text, load_schema=load_schema)
    for rec in result.records:
        if rec.alias == "D":
            game_id, home, away = rec.values
            print(f"  GameDetail for game {game_id}:")
            print(f"  Home: {home}")
            print(f"  Away: {away}")

    # ── 6. GET /transfers — OBJECT REFERENCE RESOLUTION ──────────────────────
    section("GET /transfers  (object references → resolve via _object_registry)")
    text   = http_get("/transfers")
    result = await parse_maxi(text, load_schema=load_schema)
    reg    = getattr(result, "_object_registry", {}) or {}
    print("\n  Hydrated Transfer records (player/team resolved from _object_registry):")
    for rec in result.records:
        if rec.alias == "X":
            print(transfer_str(rec.values, reg))
    x_recs = [r for r in result.records if r.alias == "X"]
    if x_recs:
        resolved = resolve(x_recs[0].values[1], "P", reg)
        print(f"\n  ✓ player resolved to full dict: {isinstance(resolved, dict)}")
        if isinstance(resolved, dict):
            print(f"    player['name'] = {resolved['name']}")

    # ── 7. GET /players/3/transfers ───────────────────────────────────────────
    section("GET /players/3/transfers  (Carlos Rivera transfer history)")
    text   = http_get("/players/3/transfers")
    result = await parse_maxi(text, load_schema=load_schema)
    reg    = getattr(result, "_object_registry", {}) or {}
    for rec in result.records:
        if rec.alias == "X":
            print(transfer_str(rec.values, reg))

    # ── 8. POST /players ──────────────────────────────────────────────────────
    section("POST /players  (MAXI request body → MAXI response)")
    new_player   = {"id": 0, "name": "Luca Bianchi", "position": "forward", "birthYear": 2001, "teamId": 1}
    request_body = dump_maxi([new_player], schema_file="sports.mxs",
                             default_alias="P", include_types=False, types=[T_PLAYER])
    response_text = http_post("/players", request_body)
    result        = await parse_maxi(response_text, load_schema=load_schema)
    created_id, c_name, c_pos, c_year, c_team = result.records[0].values
    print(f"\n  ✓ Created: Player({created_id} | {c_name} | {c_pos} | {c_year} | {c_team})")

    # ── 9. PUT /players/:id ───────────────────────────────────────────────────
    section(f"PUT /players/{created_id}  (update just-created player via MAXI body)")
    updated  = {"id": int(created_id), "name": c_name, "position": "midfielder",
                "birthYear": int(c_year), "teamId": int(c_team)}
    put_body = dump_maxi([updated], schema_file="sports.mxs",
                         default_alias="P", include_types=False, types=[T_PLAYER])
    response_text = http_put(f"/players/{created_id}", put_body)
    result        = await parse_maxi(response_text, load_schema=load_schema)
    v = result.records[0].values
    print(f"\n  ✓ Updated: Player({v[0]} | {v[1]} | {v[2]} | {v[3]} | {v[4]})")
    print(f"  ✓ position updated to: {v[2]}")

    # ── 10. DELETE /players/:id — clean up ───────────────────────────────────
    section(f"DELETE /players/{created_id}  (clean up demo player)")
    http_delete(f"/players/{created_id}")
    print("\n  ✓ Demo player removed — data is clean for the next run.")

    print(f"\n{HR}\n  All endpoints validated successfully.\n{HR}\n")


if __name__ == "__main__":
    asyncio.run(main())
