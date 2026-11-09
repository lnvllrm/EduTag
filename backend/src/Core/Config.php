<?php
declare(strict_types=1);

namespace EduTag\Core;

/** Acesso à configuração por "caminho com pontos": Config::get('db.host'). */
final class Config
{
    private static ?array $data = null;

    public static function get(string $path, mixed $default = null): mixed
    {
        self::$data ??= self::load();
        $value = self::$data;
        foreach (explode('.', $path) as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                return $default;
            }
            $value = $value[$key];
        }
        return $value;
    }

    /** Permite aos testes e scripts sobrescrever a configuração. */
    public static function override(array $data): void
    {
        self::$data = array_replace_recursive(self::load(), $data);
    }

    private static function load(): array
    {
        $dir = dirname(__DIR__, 2) . '/config';
        $file = is_file("$dir/config.php") ? "$dir/config.php" : "$dir/config.example.php";
        $config = require $file;

        // Variáveis de ambiente têm prioridade (úteis em servidores e testes).
        $env = [
            'EDUTAG_DB_HOST' => 'db.host', 'EDUTAG_DB_PORT' => 'db.port', 'EDUTAG_DB_NAME' => 'db.name',
            'EDUTAG_DB_USER' => 'db.user', 'EDUTAG_DB_PASS' => 'db.pass',
        ];
        foreach ($env as $var => $path) {
            $value = getenv($var);
            if ($value !== false) {
                $ref = &$config;
                foreach (explode('.', $path) as $key) {
                    $ref = &$ref[$key];
                }
                $ref = $key === 'port' ? (int) $value : $value;
                unset($ref);
            }
        }
        return $config;
    }
}
