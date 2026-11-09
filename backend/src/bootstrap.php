<?php
/**
 * Inicialização comum (API e scripts de linha de comando): autoload e fuso horário.
 */

declare(strict_types=1);

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('EduTag requer PHP 8.1 ou superior.');
}

// Autoload PSR-4 simples: EduTag\Core\Router → src/Core/Router.php (sem Composer).
spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'EduTag\\')) {
        $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 7)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

date_default_timezone_set((string) \EduTag\Core\Config::get('app.timezone', 'America/Sao_Paulo'));
mb_internal_encoding('UTF-8');
