<?php

namespace App\Services\Carriers\DTO;

class QuoteOptionsDTO
{
    /** @var QuoteOptionDTO[] */
    public array $options;

    public function __construct(array $options)
    {
        $this->options = $options;
    }
}
