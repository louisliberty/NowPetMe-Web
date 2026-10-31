<?php
declare(strict_types=1);

// Dynamic XML sitemap served at /sitemap.xml: the main pages, each category, and every visible pet profile.

require __DIR__ . '/api/lib/bootstrap.php';
require __DIR__ . '/api/lib/Db.php';
require __DIR__ . '/api/lib/Rules.php';

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');

$base = base_url();
$esc = fn(string $s): string => htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
$url = function (string $path, ?string $lastmod = null, string $freq = 'daily', string $prio = '0.5') use ($base, $esc): string {
    return "  <url><loc>" . $esc($base . $path) . "</loc>"
        . ($lastmod ? "<lastmod>$lastmod</lastmod>" : '')
        . "<changefreq>$freq</changefreq><priority>$prio</priority></url>\n";
};

$out = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
$out .= $url('/', null, 'hourly', '1.0');
$out .= $url('/leaderboard', null, 'hourly', '0.9');
foreach (CATEGORIES as $cat) {
    $out .= $url('/category/' . $cat, null, 'daily', '0.7');
}

try {
    $pets = Db::all('SELECT id, created_at FROM pets WHERE hidden = 0 ORDER BY id DESC LIMIT 49000');
    foreach ($pets as $p) {
        $ts = strtotime((string)$p['created_at'] . ' UTC');
        $out .= $url('/pet/' . (int)$p['id'], $ts ? gmdate('Y-m-d', $ts) : null, 'daily', '0.6');
    }
} catch (Throwable $err) {
    error_log('sitemap.php: ' . $err->getMessage());
}

echo $out . "</urlset>\n";
