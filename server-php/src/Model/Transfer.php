<?php

declare(strict_types=1);

namespace App\Model;

use Maxi\Attribute\MaxiField;
use Maxi\Attribute\MaxiType;

/**
 * Transfer DTO — mirrors the X:Transfer type in shared/sports.mxs.
 *
 * player / fromTeam / toTeam hold plain associative arrays (as returned by
 * DataLoader::loadTransfersWithRefs()) rather than nested DTO instances.
 * The typeExpr annotations tell MAXI these are P / T reference types so
 * the dumper can collect and emit them as separate records.
 */
#[MaxiType(alias: 'X', name: 'Transfer')]
class Transfer
{
    public function __construct(
        #[MaxiField(typeExpr: 'int')]
        public int $id = 0,

        /** @var array<string,mixed> Full Player record (from DataLoader join) */
        #[MaxiField(typeExpr: 'P')]
        public array $player = [],

        /** @var array<string,mixed> Full Team record for the source club */
        #[MaxiField(typeExpr: 'T')]
        public array $fromTeam = [],

        /** @var array<string,mixed> Full Team record for the destination club */
        #[MaxiField(typeExpr: 'T')]
        public array $toTeam = [],

        #[MaxiField(annotation: 'date', required: true)]
        public string $date = '',

        #[MaxiField(typeExpr: 'decimal')]
        public ?float $fee = null,
    ) {}
}
