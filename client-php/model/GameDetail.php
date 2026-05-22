<?php

declare(strict_types=1);

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * GameDetail DTO — mirrors the D:GameDetail type in shared/sports.mxs.
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
