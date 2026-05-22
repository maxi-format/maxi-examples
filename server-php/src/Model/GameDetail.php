<?php

declare(strict_types=1);

namespace App\Model;

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * GameDetail DTO — mirrors the D:GameDetail type in shared/sports.mxs.
 *
 * homePlayers / awayPlayers hold arrays of per-player stats
 * (each element is a plain associative array compatible with PlayerStats).
 * The typeExpr annotation tells MAXI these are inline S[] arrays.
 */
#[MaxiType(alias: 'D', name: 'GameDetail')]
class GameDetail
{
    public function __construct(
        #[MaxiField(typeExpr: 'int')]
        public int $gameId = 0,

        /** @var PlayerStats[] */
        #[MaxiField(typeExpr: 'S[]')]
        public array $homePlayers = [],

        /** @var PlayerStats[] */
        #[MaxiField(typeExpr: 'S[]')]
        public array $awayPlayers = [],
    ) {}
}
