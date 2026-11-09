<?php
/**
 * Roteador para o servidor embutido do PHP (desenvolvimento, sem Apache/XAMPP).
 *
 * Na raiz do repositório:
 *     php -S localhost:8080 backend/dev-router.php
 * Front:  http://localhost:8080/frontend/login.html
 * API:    http://localhost:8080/backend/api/
 */

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$root = dirname(__DIR__);

if (str_starts_with($path, '/backend/api/') || $path === '/backend/api') {
    $_SERVER['SCRIPT_NAME'] = '/backend/api/index.php';
    require __DIR__ . '/api/index.php';
    return true;
}

// Bloqueia o acesso HTTP ao código e às configurações do back-end.
if (str_starts_with($path, '/backend/') || str_starts_with($path, '/database/')) {
    http_response_code(403);
    echo 'Acesso negado.';
    return true;
}

return false; // arquivos estáticos (frontend/...)
