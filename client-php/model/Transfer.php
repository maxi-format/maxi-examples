<?php

declare(strict_types=1);

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * Transfer DTO — mirrors the X:Transfer type in shared/sports.mxs.
 * player, fromTeam, toTeam are object references resolved from the record pool.
 */
#[MaxiType(alias: 'X', name: 'Transfer')]
class Transfer
{
    public function __construct(
        #[MaxiField(typeExpr: 'int')]
        public int $id = 0,

        #[MaxiField(typeExpr: 'P')]
        public ?Player $player = null,

        #[MaxiField(typeExpr: 'T')]
        public ?Team $fromTeam = null,

        #[MaxiField(typeExpr: 'T')]
        public ?Team $toTeam = null,

        #[MaxiField(annotation: 'date', required: true)]
        public string $date = '',

        #[MaxiField(typeExpr: 'decimal')]
        public ?float $fee = null,
    ) {}
}
