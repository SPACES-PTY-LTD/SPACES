<?php

return [
    'default_currency' => env('BILLING_DEFAULT_CURRENCY', 'USD'),
    'default_gateway' => env('BILLING_DEFAULT_GATEWAY', 'free'),
    'invoice_due_days' => (int) env('BILLING_INVOICE_DUE_DAYS', 7),
    'auto_charge_enabled' => filter_var(env('BILLING_AUTO_CHARGE_ENABLED', true), FILTER_VALIDATE_BOOL),
    'grace_period_days' => (int) env('BILLING_GRACE_PERIOD_DAYS', 7),
    'stripe' => [
        'secret_key' => env('BILLING_STRIPE_SECRET_KEY'),
        'publishable_key' => env('BILLING_STRIPE_PUBLISHABLE_KEY'),
        'webhook_secret' => env('BILLING_STRIPE_WEBHOOK_SECRET'),
    ],
    'payfast' => [
        'merchant_id' => env('BILLING_PAYFAST_MERCHANT_ID'),
        'merchant_key' => env('BILLING_PAYFAST_MERCHANT_KEY'),
        'passphrase' => env('BILLING_PAYFAST_PASSPHRASE'),
        'sandbox' => filter_var(env('BILLING_PAYFAST_SANDBOX', true), FILTER_VALIDATE_BOOL),
    ],
    'paystack' => [
        'secret_key' => env('BILLING_PAYSTACK_SECRET_KEY'),
        'public_key' => env('BILLING_PAYSTACK_PUBLIC_KEY'),
        'webhook_secret' => env('BILLING_PAYSTACK_WEBHOOK_SECRET'),
    ],
];
