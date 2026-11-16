<?php

return [
    // Public booking links and signed-in ticket links may use different origins.
    'public_url' => env('WEBSITE_PUBLIC_URL', env('FRONTEND_URL', 'http://localhost:3000')),
    'admin_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    'support_disk' => env('WEBSITE_SUPPORT_DISK', 'local'),
];
