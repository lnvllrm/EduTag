<?php
declare(strict_types=1);

namespace EduTag\Core;

use PDO;
use PDOException;
use Throwable;

/**
 * Conexão única (PDO) e atalhos de consulta.
 * Sempre usa prepared statements nativos: nunca concatene valores no SQL.
 * (Com prepares nativos, cada placeholder nomeado só pode aparecer UMA vez na consulta.)
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = Config::get('db');
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $c['host'], $c['port'], $c['name'], $c['charset']);
            try {
                self::$pdo = new PDO($dsn, $c['user'], $c['pass'], [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::ATTR_STRINGIFY_FETCHES  => false,
                ]);
            } catch (PDOException $e) {
                error_log('[EduTag] Falha ao conectar ao banco: ' . $e->getMessage());
                throw new ApiException(503, 'database_unavailable', 'Não foi possível conectar ao banco de dados.');
            }
        }
        return self::$pdo;
    }

    /** Troca a conexão (testes / scripts de linha de comando). */
    public static function reset(): void
    {
        self::$pdo = null;
    }

    /** @return list<array<string,mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $row = self::run($sql, $params)->fetch(PDO::FETCH_NUM);
        return $row === false ? null : $row[0];
    }

    /** Executa INSERT/UPDATE/DELETE e devolve as linhas afetadas. */
    public static function exec(string $sql, array $params = []): int
    {
        return self::run($sql, $params)->rowCount();
    }

    public static function insert(string $sql, array $params = []): int
    {
        self::run($sql, $params);
        return (int) self::pdo()->lastInsertId();
    }

    /**
     * Executa o callback dentro de uma transação (rollback em qualquer exceção).
     * @template T
     * @param callable():T $fn
     * @return T
     */
    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) {
            return $fn();
        }
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** Placeholders nomeados únicos para uma lista (IN): ['a'=>…] → ':a0, :a1', params. */
    public static function in(string $prefix, array $values): array
    {
        $names = [];
        $params = [];
        foreach (array_values($values) as $i => $v) {
            $names[] = ":{$prefix}{$i}";
            $params["{$prefix}{$i}"] = $v;
        }
        return [implode(', ', $names) ?: 'NULL', $params];
    }

    /** True se a exceção é violação de chave única (MySQL 1062). */
    public static function isDuplicate(Throwable $e): bool
    {
        return $e instanceof PDOException && (int) ($e->errorInfo[1] ?? 0) === 1062;
    }

    private static function run(string $sql, array $params): \PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        foreach ($params as $name => $value) {
            $type = match (true) {
                is_int($value)  => PDO::PARAM_INT,
                is_bool($value) => PDO::PARAM_BOOL,
                $value === null => PDO::PARAM_NULL,
                default         => PDO::PARAM_STR,
            };
            $stmt->bindValue(is_int($name) ? $name + 1 : ':' . ltrim((string) $name, ':'), $value, $type);
        }
        $stmt->execute();
        return $stmt;
    }
}
