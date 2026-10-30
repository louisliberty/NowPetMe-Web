<?php
declare(strict_types=1);

// NowPetMe API front controller. Apache rewrites every /api/... request here (see ../.htaccess).

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/Db.php';
require __DIR__ . '/lib/Auth.php';
require __DIR__ . '/lib/Rules.php';
require __DIR__ . '/lib/Repo.php';
require __DIR__ . '/lib/Services.php';
require __DIR__ . '/lib/Handlers.php';

install_error_handlers();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$pos = strpos($uri, '/api');
$path = $pos === false ? $uri : substr($uri, $pos + 4);
$path = '/' . trim($path, '/');

// Basic CSRF defence: browsers always send Origin on cross-site writes.
if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && $origin !== 'null') {
        $originHost = parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
        $host = $_SERVER['HTTP_HOST'] ?? '';
        if (strcasecmp($originHost, $host) !== 0) {
            throw new HttpError(403, 'Cross-site request blocked');
        }
    }
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$routes = [
    ['POST', '#^/auth/register$#', 'register'],
    ['POST', '#^/auth/login$#', 'login'],
    ['POST', '#^/auth/logout$#', 'logout'],
    ['GET', '#^/auth/me$#', 'me'],
    ['POST', '#^/auth/forgot-password$#', 'forgotPassword'],
    ['POST', '#^/auth/reset-password$#', 'resetPassword'],
    ['GET', '#^/auth/verify$#', 'verifyEmail'],
    ['POST', '#^/auth/resend-verification$#', 'resendVerification'],

    ['PATCH', '#^/users/me$#', 'updateProfile'],
    ['GET', '#^/users/([A-Za-z0-9_%]+)$#', 'userProfile'],

    ['GET', '#^/pets$#', 'listPets'],
    ['POST', '#^/pets$#', 'createPet'],
    ['GET', '#^/pets/count$#', 'petCount'],
    ['GET', '#^/pets/random$#', 'randomPet'],
    ['GET', '#^/pets/hot$#', 'hotPets'],
    ['GET', '#^/pets/top$#', 'topPets'],
    ['GET', '#^/pets/of-the-day$#', 'petOfTheDay'],
    ['GET', '#^/pets/(\d+)$#', 'getPet'],
    ['POST', '#^/pets/(\d+)/vote$#', 'vote'],
    ['GET', '#^/pets/(\d+)/comments$#', 'listComments'],
    ['POST', '#^/pets/(\d+)/comments$#', 'createComment'],

    ['PATCH', '#^/comments/(\d+)$#', 'editComment'],
    ['DELETE', '#^/comments/(\d+)$#', 'deleteComment'],
    ['POST', '#^/comments/(\d+)/like$#', 'likeComment'],
    ['POST', '#^/comments/(\d+)/reactions$#', 'reactToComment'],

    ['POST', '#^/reports$#', 'report'],
];

$lookup = $method === 'HEAD' ? 'GET' : $method;
foreach ($routes as [$m, $pattern, $handler]) {
    if ($m === $lookup && preg_match($pattern, $path, $matches)) {
        Handlers::$handler($matches);
        exit;
    }
}

throw new HttpError(404, 'Not found');
