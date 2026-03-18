<?php

namespace Database\Factories;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class MerchantFactory extends Factory
{
    protected $model = Merchant::class;

    public function definition(): array
    {
        return [
            'owner_user_id' => User::factory(),
            'name' => $this->faker->company,
            'legal_name' => $this->faker->company.' Pty Ltd',
            'status' => 'active',
            'billing_email' => $this->faker->companyEmail,
            'default_webhook_url' => $this->faker->url,
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
            'metadata' => ['source' => 'factory'],
        ];
    }
}
