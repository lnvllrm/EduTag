<?php
declare(strict_types=1);

namespace EduTag\Core;

use RuntimeException;

/** Erro "esperado" da API: vira a resposta { error: { code, message, fields } }. */
final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?array $fields = null,
    ) {
        parent::__construct($message);
    }

    public static function validation(array $fields, string $message = 'Verifique os campos destacados.'): self
    {
        return new self(422, 'validation_error', $message, $fields);
    }

    public static function notFound(string $what = 'Registro'): self
    {
        return new self(404, 'not_found', "$what não encontrado.");
    }

    public static function forbidden(): self
    {
        return new self(403, 'forbidden', 'Você não tem permissão para acessar este recurso.');
    }

    public static function unauthenticated(): self
    {
        return new self(401, 'unauthenticated', 'Sessão expirada. Faça login novamente.');
    }

    public static function conflict(string $message): self
    {
        return new self(409, 'in_use', $message);
    }
}
