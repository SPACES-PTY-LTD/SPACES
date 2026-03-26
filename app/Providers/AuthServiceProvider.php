<?php

namespace App\Providers;

use App\Models\Booking;
use App\Models\Account;
use App\Models\DeliveryRoute;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Quote;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\WebhookSubscription;
use App\Policies\BookingPolicy;
use App\Policies\AccountPolicy;
use App\Policies\MerchantEnvironmentPolicy;
use App\Policies\MerchantPolicy;
use App\Policies\QuotePolicy;
use App\Policies\RoutePolicy;
use App\Policies\RunPolicy;
use App\Policies\ShipmentPolicy;
use App\Policies\WebhookSubscriptionPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Account::class => AccountPolicy::class,
        Merchant::class => MerchantPolicy::class,
        DeliveryRoute::class => RoutePolicy::class,
        MerchantEnvironment::class => MerchantEnvironmentPolicy::class,
        Shipment::class => ShipmentPolicy::class,
        Run::class => RunPolicy::class,
        Quote::class => QuotePolicy::class,
        Booking::class => BookingPolicy::class,
        WebhookSubscription::class => WebhookSubscriptionPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();
    }
}
