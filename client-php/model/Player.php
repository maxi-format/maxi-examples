<?php

declare(strict_types=1);

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * Player DTO — mirrors the P:Player type in shared/sports.mxs.
 * Annotated so Maxi::dumpAuto() can infer the MAXI schema for POST/PUT requests.
 */
#[MaxiType(alias: 'P', name: 'Player')]
class Player
{
    public function __construct(
        #[MaxiField(typeExpr: 'int')]
        public int $id = 0,

        #[MaxiField(required: true)]
        public string $name = '',

        #[MaxiField(typeExpr: 'enum[forward,midfielder,defender,goalkeeper]')]
        public string $position = '',

        #[MaxiField(typeExpr: 'int')]
        public int $birthYear = 0,

        #[MaxiField(typeExpr: 'T')]
        public ?Team $team = null,
    ) {}
}
