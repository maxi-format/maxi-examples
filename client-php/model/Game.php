<?php

declare(strict_types=1);

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * Game DTO — mirrors the G:Game type in shared/sports.mxs.
 */
#[MaxiType(alias: 'G', name: 'Game')]
class Game
{
    public function __construct(
        #[MaxiField(typeExpr: 'int')]
        public int $id = 0,

        #[MaxiField(typeExpr: 'T')]
        public ?Team $homeTeam = null,

        #[MaxiField(typeExpr: 'T')]
        public ?Team $awayTeam = null,

        #[MaxiField(annotation: 'date', required: true)]
        public string $date = '',

        #[MaxiField(typeExpr: 'enum[scheduled,live,finished,cancelled]')]
        public string $status = '',

        #[MaxiField(typeExpr: 'int', defaultValue: 0)]
        public int $homeScore = 0,

        #[MaxiField(typeExpr: 'int', defaultValue: 0)]
        public int $awayScore = 0,
    ) {}
}
