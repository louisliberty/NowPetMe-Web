<?php
// Router for `php -S`, mimicking the Apache rules in public/.htaccess. Tests only.
$root = getenv('TEST_ROOT') ?: dirname(__DIR__) . '/public';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api(/|$)#', $path)) { require $root . '/api/index.php'; return true; }
if (preg_match('#^/pet/(\d+)/?$#', $path, $m)) { $_GET['id'] = $m[1]; require $root . '/seo.php'; return true; }
$file = $root . $path;
if ($path !== '/' && is_file($file) && !str_ends_with($file, '.php')) { return false; }
header('Content-Type: text/html'); readfile($root . '/index.html'); return true;
