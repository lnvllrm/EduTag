<?php
declare(strict_types=1);

namespace EduTag\Core;

/** Requisição HTTP já normalizada (método, caminho relativo à API, query e corpo JSON). */
final class Request
{
    private function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        private readonly string $rawBody,
        private readonly array $headers,
        private ?array $json = null,
    ) {
    }

    public static function capture(): self
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        // Caminho relativo à pasta do front controller (ex.: /EduTag/backend/api).
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        $path = ($base !== '' && str_starts_with($uri, $base)) ? substr($uri, strlen($base)) : $uri;
        $path = trim(rawurldecode($path), '/');
        if (str_starts_with($path, 'index.php')) {
            $path = trim(substr($path, strlen('index.php')), '/');
        }

        $headers = [];
        foreach (function_exists('getallheaders') ? (getallheaders() ?: []) : [] as $name => $value) {
            $headers[strtolower($name)] = $value;
        }
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] ??= $value;
            }
        }
        $headers['content-type'] ??= $_SERVER['CONTENT_TYPE'] ?? '';

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $path,
            $_GET,
            file_get_contents('php://input') ?: '',
            $headers,
        );
    }

    /** Cópia da requisição com outra query string. */
    public function withQuery(array $query): self
    {
        return new self($this->method, $this->path, $query, $this->rawBody, $this->headers, $this->json);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /** Corpo JSON como array (vazio quando não há corpo). */
    public function body(): array
    {
        if ($this->json !== null) {
            return $this->json;
        }
        if (trim($this->rawBody) === '') {
            return $this->json = [];
        }
        if (!str_contains(strtolower((string) $this->header('content-type')), 'application/json')) {
            throw new ApiException(415, 'unsupported_media_type', 'Envie o corpo como application/json.');
        }
        $decoded = json_decode($this->rawBody, true);
        if (!is_array($decoded)) {
            throw new ApiException(400, 'invalid_json', 'O corpo da requisição não é um JSON válido.');
        }
        return $this->json = $decoded;
    }

    public function queryString(string $key): ?string
    {
        $v = $this->query[$key] ?? null;
        return is_string($v) && trim($v) !== '' ? trim($v) : null;
    }

    public function queryInt(string $key): ?int
    {
        $v = $this->queryString($key);
        return $v !== null && ctype_digit($v) ? (int) $v : null;
    }
}
