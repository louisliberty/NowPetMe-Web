<?php
declare(strict_types=1);

final class Auth
{
    public const COOKIE = 'npm_sid';
    private static ?int $uid = null;
    private static bool $loaded = false;
    private static bool $configured = false;

    private static function configure(): void
    {
        if (self::$configured) {
            return;
        }
        self::$configured = true;
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_cookies', '1');
        ini_set('session.gc_maxlifetime', (string)DbSessionHandler::LIFETIME);
        session_name(self::COOKIE);
        session_set_cookie_params([
            'lifetime' => DbSessionHandler::LIFETIME,
            'path' => '/',
            'secure' => is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_set_save_handler(new DbSessionHandler(), true);
    }

    /** Current logged-in user id, or null. Only touches the session if a session cookie was sent. */
    public static function userId(): ?int
    {
        if (self::$loaded) {
            return self::$uid;
        }
        self::$loaded = true;
        if (empty($_COOKIE[self::COOKIE])) {
            return null;
        }
        self::configure();
        session_start();
        self::$uid = isset($_SESSION['uid']) ? (int)$_SESSION['uid'] : null;
        session_write_close();
        return self::$uid;
    }

    public static function login(int $userId): void
    {
        self::configure();
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        session_regenerate_id(true);
        $_SESSION['uid'] = $userId;
        session_write_close();
        self::$uid = $userId;
        self::$loaded = true;
    }

    public static function logout(): void
    {
        if (!empty($_COOKIE[self::COOKIE])) {
            self::configure();
            if (session_status() !== PHP_SESSION_ACTIVE) {
                session_start();
            }
            $_SESSION = [];
            session_destroy();
            setcookie(self::COOKIE, '', [
                'expires' => time() - 3600,
                'path' => '/',
                'secure' => is_https(),
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
        self::$uid = null;
        self::$loaded = true;
    }

    public static function require(): int
    {
        $id = self::userId();
        if ($id === null) {
            throw new HttpError(401, 'You must be logged in to do this');
        }
        return $id;
    }
}
