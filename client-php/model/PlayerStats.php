<?php

declare(strict_types=1);

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * PlayerStats DTO — mirrors the S:PlayerStats type in shared/sports.mxs.
 */
#[MaxiType(alias: 'S', name: 'PlayerStats')]
class PlayerStats
{
    public function __construct(
        #[MaxiField(typeExpr: 'P')]
        public ?Player $player = null,

        #[MaxiField(typeExpr: 'int', defaultValue: 0)]
        public int $goals = 0,

        #[MaxiField(typeExpr: 'int', defaultValue: 0)]
        public int $assists = 0,

        #[MaxiField(typeExpr: 'int', defaultValue: 0)]
        public int $minutesPlayed = 0,
    ) {}
}
