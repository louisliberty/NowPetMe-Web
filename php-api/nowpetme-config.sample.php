<?php
// Copy this file to  nowpetme-config.php  and save it ONE FOLDER ABOVE public_html
// (e.g. /home/yourcpanelname/nowpetme-config.php). It holds secrets, so it must never be
// inside public_html and must never be committed to GitHub.

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'cpanelname_nowpetme',   // cPanel prefixes database and user names
        'user' => 'cpanelname_nowpetme',
        'pass' => 'CHANGE_ME',
    ],

    // Your public site address, no trailing slash. Used in emails and share links.
    'base_url' => 'https://nowpetme.com',

    // Any long random string. Changing it later resets who counts as "already voted".
    'ip_salt' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',

    // Resend (https://resend.com) for verification / reset / Pet of the Day emails.
    'resend_api_key' => '',
    'from_email' => 'NowPetMe <noreply@nowpetme.com>',   // must be a domain verified in Resend

    // OpenAI key for photo moderation (gpt-4o-mini).
    'openai_api_key' => '',

    // Leave '' unless the site is behind Cloudflare, then use 'CF-Connecting-IP'.
    // Only set this if you trust that proxy; otherwise visitors could fake their IP.
    'trust_proxy_header' => '',

    'debug' => false,
];
