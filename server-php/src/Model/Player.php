<?php

declare(strict_types=1);

namespace App\Model;

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * Player DTO — mirrors the P:Player type in shared/sports.mxs.
 *
 * Annotated with #[MaxiType] / #[MaxiField] so that MaxiSchemaRegistry
 * can derive the MAXI schema from the class rather than from hand-written
 * array descriptors.
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
