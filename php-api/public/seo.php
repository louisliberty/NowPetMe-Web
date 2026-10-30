<?php
declare(strict_types=1);

// Serves the React app's index.html for /pet/{id} with pet-specific <title>, description and Open Graph
// tags, so shared links (iMessage, Facebook, X, WhatsApp, ...) show the pet's photo and name.

require __DIR__ . '/api/lib/bootstrap.php';
require __DIR__ . '/api/lib/Db.php';
require __DIR__ . '/api/lib/Rules.php';
require __DIR__ . '/api/lib/Repo.php';
require __DIR__ . '/api/lib/Services.php';

$html = @file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
    http_response_code(500);
    echo 'App not built';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');

try {
    $pet = Repo::pet((int)($_GET['id'] ?? 0));
} catch (Throwable $err) {
    error_log('seo.php: ' . $err->getMessage());
    $pet = null;
}

if (!$pet || (int)$pet['hidden']) {
    http_response_code(404);
    echo $html;
    exit;
}

$labels = ['dog' => 'Dog', 'cat' => 'Cat', 'bird' => 'Bird', 'rabbit' => 'Rabbit', 'fish' => 'Fish', 'other' => 'Pet'];
$label = $labels[$pet['category']] ?? 'Pet';
$votes = (int)$pet['vote_count'];
$avg = $votes > 0 ? number_format(((int)$pet['total_score']) / $votes, 1) : null;
$title = $pet['name'] . ' - ' . $label . ' | NowPetMe';
$desc = $avg !== null
    ? "Rated $avg/10 by $votes " . ($votes === 1 ? 'voter' : 'voters') . ". Vote on how cute {$pet['name']} is!"
    : "Be the first to rate {$pet['name']}! Vote on how cute this {$label} is.";
if (!empty($pet['story'])) {
    $desc .= ' ' . mb_substr((string)$pet['story'], 0, 120);
}
$base = base_url();
$url = $base . '/pet/' . (int)$pet['id'];
$img = str_starts_with($pet['photo_url'], 'http') ? $pet['photo_url'] : $base . $pet['photo_url'];

$tags = implode("\n    ", [
    '<meta name="description" content="' . e($desc) . '" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="NowPetMe" />',
    '<meta property="og:title" content="' . e($title) . '" />',
    '<meta property="og:description" content="' . e($desc) . '" />',
    '<meta property="og:url" content="' . e($url) . '" />',
    '<meta property="og:image" content="' . e($img) . '" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' . e($title) . '" />',
    '<meta name="twitter:description" content="' . e($desc) . '" />',
    '<meta name="twitter:image" content="' . e($img) . '" />',
    '<link rel="canonical" href="' . e($url) . '" />',
]);

// Drop the generic tags from the static page, then add the pet-specific ones.
$html = preg_replace('#<title>.*?</title>#is', '<title>' . e($title) . '</title>', $html, 1);
$html = preg_replace('#\s*<meta\s+(?:name="description"|property="og:[a-z:_]+")[^>]*>#i', '', $html);
$html = preg_replace('#</head>#i', "    $tags\n  </head>", $html, 1);
echo $html;
