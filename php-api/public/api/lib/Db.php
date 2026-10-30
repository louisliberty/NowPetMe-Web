<?php
declare(strict_types=1);

final class Db
{
    private static ?PDO $pdo = null;
    private static int $depth = 0;

    public static function pdo(): PDO
    {
        if (self::$pdo) {
            return self::$pdo;
        }
        $c = config('db');
        $opts = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];
        if (($c['driver'] ?? 'mysql') === 'sqlite') {
            // SQLite is only used by the automated tests.
            $pdo = new PDO('sqlite:' . $c['path'], null, null, $opts);
            $pdo->exec('PRAGMA busy_timeout = 5000');
        } else {
            $opts[PDO::ATTR_EMULATE_PREPARES] = false;
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $c['host'] ?? 'localhost',
                (int)($c['port'] ?? 3306),
                $c['name'] ?? ''
            );
            $pdo = new PDO($dsn, (string)($c['user'] ?? ''), (string)($c['pass'] ?? ''), $opts);
            $pdo->exec("SET time_zone = '+00:00'");
        }
        return self::$pdo = $pdo;
    }

    public static function isSqlite(): bool
    {
        return (config('db.driver') ?? 'mysql') === 'sqlite';
    }

    public static function q(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        foreach (array_values($params) as $i => $v) {
            $type = match (true) {
                is_int($v) => PDO::PARAM_INT,
                is_bool($v) => PDO::PARAM_BOOL,
                $v === null => PDO::PARAM_NULL,
                default => PDO::PARAM_STR,
            };
            $st->bindValue($i + 1, is_float($v) ? (string)$v : $v, $type);
        }
        $st->execute();
        return $st;
    }

    /** @return array<int,array<string,mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        return self::q($sql, $params)->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::q($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function val(string $sql, array $params = []): mixed
    {
        $row = self::q($sql, $params)->fetch(PDO::FETCH_NUM);
        return $row === false ? null : $row[0];
    }

    public static function exec(string $sql, array $params = []): int
    {
        return self::q($sql, $params)->rowCount();
    }

    public static function lastId(): int
    {
        return (int)self::pdo()->lastInsertId();
    }

    /** INSERT that silently skips rows violating a unique key. Returns true if a row was inserted. */
    public static function insertIgnore(string $table, array $row): bool
    {
        $cols = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
        $marks = implode(', ', array_fill(0, count($row), '?'));
        $verb = self::isSqlite() ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
        return self::exec("$verb INTO `$table` ($cols) VALUES ($marks)", array_values($row)) > 0;
    }

    public static function insert(string $table, array $row): int
    {
        $cols = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
        $marks = implode(', ', array_fill(0, count($row), '?'));
        self::exec("INSERT INTO `$table` ($cols) VALUES ($marks)", array_values($row));
        return self::lastId();
    }

    public static function random(): string
    {
        return self::isSqlite() ? 'RANDOM()' : 'RAND()';
    }

    /** Run $fn inside a transaction (nested calls reuse the outer one). */
    public static function tx(callable $fn): mixed
    {
        $pdo = self::pdo();
        if (self::$depth > 0) {
            return $fn();
        }
        $pdo->beginTransaction();
        self::$depth++;
        try {
            $r = $fn();
            $pdo->commit();
            return $r;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        } finally {
            self::$depth--;
        }
    }
}

/** PHP sessions stored in MySQL so shared-hosting session cleanup can't log users out. */
final class DbSessionHandler implements SessionHandlerInterface
{
    public const LIFETIME = 30 * 86400;

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $row = Db::one('SELECT data FROM sessions WHERE id = ? AND expires_at > ?', [$id, time()]);
        return $row ? (string)$row['data'] : '';
    }

    public function write(string $id, string $data): bool
    {
        if ($data === '') {
            return true; // don't store empty anonymous sessions
        }
        Db::exec('REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)', [$id, $data, time() + self::LIFETIME]);
        return true;
    }

    public function destroy(string $id): bool
    {
        Db::exec('DELETE FROM sessions WHERE id = ?', [$id]);
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        return Db::exec('DELETE FROM sessions WHERE expires_at < ?', [time()]);
    }
}

final class RateLimit
{
    /** Returns false when the caller has exceeded $max hits within $windowSec. */
    public static function hit(string $key, int $max, int $windowSec): bool
    {
        $key = substr($key, 0, 100);
        $now = time();
        $row = Db::one('SELECT window_start, hits FROM rate_limits WHERE k = ?', [$key]);
        if (!$row || (int)$row['window_start'] < $now - $windowSec) {
            Db::exec('DELETE FROM rate_limits WHERE k = ?', [$key]);
            Db::insertIgnore('rate_limits', ['k' => $key, 'window_start' => $now, 'hits' => 1]);
            return true;
        }
        if ((int)$row['hits'] >= $max) {
            return false;
        }
        Db::exec('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?', [$key]);
        return true;
    }
}
