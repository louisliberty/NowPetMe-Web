<?php
declare(strict_types=1);

mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');

final class HttpError extends RuntimeException
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}

/** Read a config value using dot notation, e.g. config('db.host'). */
function config(?string $path = null, mixed $default = null): mixed
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = load_config();
    }
    if ($path === null) {
        return $cfg;
    }
    $cur = $cfg;
    foreach (explode('.', $path) as $seg) {
        if (!is_array($cur) || !array_key_exists($seg, $cur)) {
            return $default;
        }
        $cur = $cur[$seg];
    }
    return $cur;
}

function load_config(): array
{
    $candidates = array_filter([
        getenv('NOWPETME_CONFIG') ?: null,
        // One folder above the site's web root (main domain: /home/user/public_html -> /home/user).
        !empty($_SERVER['DOCUMENT_ROOT']) ? dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')) . '/nowpetme-config.php' : null,
        // Two folders above (addon domain: /home/user/public_html/example.com -> /home/user).
        !empty($_SERVER['DOCUMENT_ROOT']) ? dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/\\'), 2) . '/nowpetme-config.php' : null,
        dirname(__DIR__) . '/config.php',
    ]);
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $c = require $file;
            if (is_array($c)) {
                return $c;
            }
        }
    }
    throw new RuntimeException('NowPetMe config file (nowpetme-config.php) not found');
}

function web_root(): string
{
    return dirname(__DIR__, 2);
}

function uploads_dir(): string
{
    $dir = web_root() . '/uploads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht, uploads_htaccess());
    }
    return $dir;
}

function uploads_htaccess(): string
{
    return <<<'HT'
Options -Indexes -ExecCGI
RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar
<FilesMatch "(?i)\.(php[0-9]?|phtml|phar|pl|py|cgi|sh)$">
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Order allow,deny
    Deny from all
  </IfModule>
</FilesMatch>
<IfModule mod_php.c>
  php_flag engine off
</IfModule>

HT;
}

function is_https(): bool
{
    $h = $_SERVER['HTTPS'] ?? '';
    if ($h !== '' && strtolower((string)$h) !== 'off') {
        return true;
    }
    return strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/** Public site URL used in emails and share links. Set base_url in config for production. */
function base_url(): string
{
    $configured = (string)config('base_url', '');
    if ($configured !== '') {
        return rtrim($configured, '/');
    }
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return (is_https() ? 'https' : 'http') . '://' . $host;
}

function client_ip(): string
{
    $header = (string)config('trust_proxy_header', '');
    if ($header !== '') {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $header));
        if (!empty($_SERVER[$key])) {
            $v = trim(explode(',', (string)$_SERVER[$key])[0]);
            if (filter_var($v, FILTER_VALIDATE_IP)) {
                return $v;
            }
        }
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/** Anonymised, salted IP used for vote/like/upload limits (never store raw IPs). */
function ip_hash(): string
{
    return substr(hash('sha256', client_ip() . (string)config('ip_salt', 'change-me')), 0, 16);
}

function now_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}

function iso(?string $dt): ?string
{
    if ($dt === null || $dt === '') {
        return null;
    }
    $d = new DateTimeImmutable($dt, new DateTimeZone('UTC'));
    return $d->format('Y-m-d\TH:i:s.000\Z');
}

function request_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_contains($ct, 'application/json')) {
        $decoded = json_decode((string)file_get_contents('php://input'), true);
        $body = is_array($decoded) ? $decoded : [];
    } else {
        $body = $_POST;
    }
    return $body;
}

function respond(int $status, mixed $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

/** Run a callback after the response has been sent to the browser. */
function after_response(callable $cb): void
{
    static $registered = false;
    $GLOBALS['__after_response'][] = $cb;
    if ($registered) {
        return;
    }
    $registered = true;
    register_shutdown_function(static function () {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        foreach ($GLOBALS['__after_response'] ?? [] as $fn) {
            try {
                $fn();
            } catch (Throwable $e) {
                error_log('after_response failed: ' . $e->getMessage());
            }
        }
    });
}

function install_error_handlers(): void
{
    set_exception_handler(static function (Throwable $e) {
        if ($e instanceof HttpError) {
            respond($e->status, ['message' => $e->getMessage()]);
        }
        error_log('NowPetMe error: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        $msg = 'Internal Server Error';
        try {
            if (config('debug', false)) {
                $msg = $e->getMessage();
            }
        } catch (Throwable) {
        }
        respond(500, ['message' => $msg]);
    });
}
