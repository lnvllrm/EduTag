<?php
declare(strict_types=1);

namespace EduTag\Core;

/** Resposta JSON no contrato { data, meta } / { error }. */
final class Response
{
    private function __construct(private readonly int $status, private readonly array $payload)
    {
    }

    public static function ok(mixed $data, ?array $meta = null, int $status = 200): self
    {
        return new self($status, ['data' => $data] + ($meta !== null ? ['meta' => $meta] : []));
    }

    public static function created(mixed $data): self
    {
        return self::ok($data, null, 201);
    }

    public static function error(int $status, string $code, string $message, ?array $fields = null): self
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields) {
            $error['fields'] = $fields;
        }
        return new self($status, ['error' => $error]);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($this->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    public function status(): int
    {
        return $this->status;
    }
}
