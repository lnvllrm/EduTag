<?php
declare(strict_types=1);

namespace EduTag\Core;

/**
 * Sessão do usuário (cookie PHP) e perfil.
 * Só o id fica na sessão: o usuário é relido do banco a cada requisição, então
 * desativar uma conta tem efeito imediato.
 */
final class Auth
{
    private static ?array $cached = null;
    private static bool $loaded = false;

    private static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') === '443';
        session_name((string) Config::get('session.name', 'edutag_sid'));
        session_set_cookie_params([
            'lifetime' => (int) Config::get('session.lifetime', 0),
            'path'     => '/',
            'secure'   => $https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_start();
    }

    /** Usuário autenticado ou null. */
    public static function user(): ?array
    {
        if (self::$loaded) {
            return self::$cached;
        }
        self::$loaded = true;

        if (!isset($_COOKIE[(string) Config::get('session.name', 'edutag_sid')])) {
            return null;
        }
        self::startSession();

        $id = $_SESSION['uid'] ?? null;
        $last = $_SESSION['last'] ?? 0;
        if (!$id || (time() - $last) > (int) Config::get('session.idle_ttl', 28800)) {
            self::destroy();
            return null;
        }
        $row = Database::one('SELECT * FROM usuario WHERE id = :id AND ativo = 1', ['id' => $id]);
        if ($row === null) {
            self::destroy();
            return null;
        }
        $_SESSION['last'] = time();
        return self::$cached = self::present($row);
    }

    public static function login(array $row): array
    {
        self::startSession();
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $row['id'];
        $_SESSION['last'] = time();
        self::$loaded = true;
        return self::$cached = self::present($row);
    }

    public static function logout(): void
    {
        if (isset($_COOKIE[(string) Config::get('session.name', 'edutag_sid')])) {
            self::startSession();
        }
        self::destroy();
    }

    private static function destroy(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 3600, 'path' => $params['path'], 'secure' => $params['secure'],
                'httponly' => true, 'samesite' => 'Lax',
            ]);
            session_destroy();
        }
        self::$cached = null;
        self::$loaded = true;
    }

    /** Formato do usuário exposto à API (nunca inclui o hash da senha). */
    public static function present(array $row): array
    {
        $isAluno = $row['tipo'] === 'aluno';
        $user = [
            'id'              => (int) $row['id'],
            'nome'            => $row['nome'],
            'email'           => $row['email'],
            'matricula'       => $row['ra'],
            'tipo'            => $row['tipo'],
            // Perfis: administrador (gestão total), professor (somente as próprias turmas) e aluno (somente o que é dele).
            'perfil'          => $row['tipo'],
            'senhaProvisoria' => (bool) $row['senha_provisoria'],
        ];
        if ($isAluno) {
            $user['alunoId'] = (int) $row['id'];
        }
        return $user;
    }
}
