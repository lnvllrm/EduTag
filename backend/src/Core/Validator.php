<?php
declare(strict_types=1);

namespace EduTag\Core;

/**
 * Validação de entrada do corpo JSON. Acumula erros por campo e, em `check()`,
 * responde 422 no formato que o front exibe ao lado de cada campo.
 */
final class Validator
{
    /** @var array<string,string> */
    private array $errors = [];
    /** @var array<string,mixed> */
    private array $clean = [];

    public function __construct(private readonly array $input)
    {
    }

    public function fail(string $field, string $message): void
    {
        $this->errors[$field] ??= $message;
    }

    public function failed(string $field): bool
    {
        return isset($this->errors[$field]);
    }

    public function text(string $field, string $requiredMessage, int $max, bool $required = true): ?string
    {
        $raw = $this->input[$field] ?? null;
        $value = is_string($raw) || is_numeric($raw) ? trim((string) $raw) : '';
        if ($value === '') {
            if ($required) {
                $this->fail($field, $requiredMessage);
            }
            return $this->clean[$field] = null;
        }
        if (mb_strlen($value) > $max) {
            $this->fail($field, "Use no máximo $max caracteres.");
        }
        return $this->clean[$field] = $value;
    }

    public function integer(string $field, string $message, int $min = 1, ?int $max = null, bool $required = true): ?int
    {
        $raw = $this->input[$field] ?? null;
        if ($raw === null || $raw === '') {
            if ($required) {
                $this->fail($field, $message);
            }
            return $this->clean[$field] = null;
        }
        $ok = (is_int($raw) || (is_string($raw) && preg_match('/^-?\d+$/', $raw))) && (int) $raw >= $min && ($max === null || (int) $raw <= $max);
        if (!$ok) {
            $this->fail($field, $message);
            return $this->clean[$field] = null;
        }
        return $this->clean[$field] = (int) $raw;
    }

    /** Senha opcional: vazia → null (o controller aplica o padrão); se informada, mínimo de $min caracteres. */
    public function senhaOpcional(string $field = 'senha', int $min = 8): ?string
    {
        $raw = $this->input[$field] ?? null;
        $value = is_string($raw) ? $raw : '';
        if ($value === '') {
            return null;
        }
        if (mb_strlen($value) < $min) {
            $this->fail($field, "A senha deve ter pelo menos $min caracteres.");
            return null;
        }
        if (mb_strlen($value) > 72) { // limite do bcrypt
            $this->fail($field, 'Use no máximo 72 caracteres.');
            return null;
        }
        return $value;
    }

    public function email(string $field, string $requiredMessage, bool $required = true): ?string
    {
        $value = $this->text($field, $requiredMessage, 150, $required);
        if ($value !== null && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $this->fail($field, 'Informe um e-mail válido.');
        }
        return $value === null ? null : mb_strtolower($value);
    }

    public function date(string $field, string $message, bool $required = true): ?string
    {
        $value = $this->text($field, $message, 10, $required);
        if ($value !== null && !self::isDate($value)) {
            $this->fail($field, 'Informe uma data válida (AAAA-MM-DD).');
        }
        return $value;
    }

    /** Horário HH:MM (aceita HH:MM:SS) devolvido como HH:MM. */
    public function time(string $field, string $message, bool $required = true): ?string
    {
        $value = $this->text($field, $message, 8, $required);
        if ($value === null) {
            return null;
        }
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $value)) {
            $this->fail($field, 'Informe um horário válido (HH:MM).');
            return $value;
        }
        return substr($value, 0, 5);
    }

    /** @param list<string> $allowed */
    public function enum(string $field, array $allowed, string $message, ?string $default = null): ?string
    {
        $value = $this->input[$field] ?? null;
        if ($value === null || $value === '') {
            return $this->clean[$field] = $default;
        }
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            $this->fail($field, $message);
            return null;
        }
        return $this->clean[$field] = $value;
    }

    /** Lança 422 se houve qualquer erro. */
    public function check(): void
    {
        if ($this->errors) {
            throw ApiException::validation($this->errors);
        }
    }

    public static function isDate(string $value): bool
    {
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $d !== false && $d->format('Y-m-d') === $value;
    }
}
