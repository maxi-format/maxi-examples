<?php

declare(strict_types=1);

namespace App\Model;

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * Team DTO — mirrors the T:Team type in shared/sports.mxs.
 */
#[MaxiType(alias: 'T', name: 'Team')]
class Team
{
    public function __construct(
        #[MaxiField(typeExpr: 'int')]
        public int $id = 0,

        #[MaxiField(required: true)]
        public string $name = '',

        #[MaxiField(required: true)]
        public string $city = '',

        #[MaxiField(typeExpr: 'int')]
        public int $founded = 0,

        #[MaxiField(required: true)]
        public string $coach = '',
    ) {}
}
