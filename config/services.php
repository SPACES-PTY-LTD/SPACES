<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'mix' => [
        'rest_base_url' => env('MIX_REST_BASE_URL'),
        'identity_url' => env('MIX_IDENTITY_URL'),
        'client_id' => env('MIX_CLIENT_ID'),
        'client_secret' => env('MIX_CLIENT_SECRET'),
        'username' => env('MIX_USERNAME'),
        'password' => env('MIX_PASSWORD'),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com'),
        'delivery_note_model' => env('OPENAI_DELIVERY_NOTE_MODEL', 'gpt-5.6-terra'),
        'delivery_note_max_output_tokens' => (int) env('OPENAI_DELIVERY_NOTE_MAX_OUTPUT_TOKENS', 4000),
        'timeout' => (int) env('OPENAI_TIMEOUT', 90),
    ],

];
