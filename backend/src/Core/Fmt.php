<?php
declare(strict_types=1);

namespace EduTag\Core;

/**
 * Conversões entre o banco e o contrato da API.
 *
 * Vocabulário: o banco guarda `ausente` e `finalizada`; a API (e o front) usam
 * `falta` e `realizada`. A tradução acontece SÓ aqui.
 */
final class Fmt
{
    private const PRESENCA_DB_API = ['ausente' => 'falta'];
    private const AULA_DB_API = ['finalizada' => 'realizada'];

    public static function presenca(string $dbStatus): string
    {
        return self::PRESENCA_DB_API[$dbStatus] ?? $dbStatus;
    }

    public static function presencaDb(string $apiStatus): string
    {
        return array_flip(self::PRESENCA_DB_API)[$apiStatus] ?? $apiStatus;
    }

    public static function aula(string $dbStatus): string
    {
        return self::AULA_DB_API[$dbStatus] ?? $dbStatus;
    }

    public static function aulaDb(string $apiStatus): string
    {
        return array_flip(self::AULA_DB_API)[$apiStatus] ?? $apiStatus;
    }

    /** '19:00:00' → '19:00' */
    public static function hora(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }

    /** '2026-11-09 19:45:10' → '2026-11-09T19:45:10' */
    public static function dataHora(?string $dt): ?string
    {
        return $dt === null ? null : str_replace(' ', 'T', $dt);
    }

    public static function agora(): string
    {
        return date('Y-m-d H:i:s');
    }

    /** UID da tag: só hexadecimal, maiúsculo, sem separadores (A1:b2 3c → A1B23C). Retorna null se vazio. */
    public static function uid(?string $uid): ?string
    {
        if ($uid === null) {
            return null;
        }
        $clean = strtoupper(preg_replace('/[\s:\-]/', '', $uid) ?? '');
        return $clean === '' ? null : $clean;
    }
}
