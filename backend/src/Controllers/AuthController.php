<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\ApiException;
use EduTag\Core\Auth;
use EduTag\Core\Config;
use EduTag\Core\Database;
use EduTag\Core\Fmt;
use EduTag\Core\Request;
use EduTag\Core\Response;

final class AuthController
{
    /** POST auth/login  { email, senha } — "email" também aceita a matrícula (RA). */
    public function login(Request $req): Response
    {
        $body = $req->body();
        $ident = mb_strtolower(trim((string) ($body['email'] ?? '')));
        $senha = (string) ($body['senha'] ?? '');
        if ($ident === '' || $senha === '') {
            throw ApiException::validation(array_filter([
                'email' => $ident === '' ? 'Informe o e-mail.' : null,
                'senha' => $senha === '' ? 'Informe a senha.' : null,
            ]));
        }

        $this->exigirLimite($ident, $req->ip());

        $row = Database::one(
            'SELECT * FROM usuario WHERE ativo = 1 AND (email = :email OR ra = :ra)',
            ['email' => $ident, 'ra' => $ident],
        );
        // Compara sempre contra um hash, mesmo sem usuário, para não revelar quais contas existem pelo tempo de resposta.
        $hash = $row['senha_hash'] ?? '$2y$10$usesomesillystringforsaltsoitdoesntmatchanything0000000000000';
        if (!password_verify($senha, $hash) || $row === null) {
            $this->registrarFalha($ident, $req->ip());
            throw new ApiException(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
        }

        if (password_needs_rehash($row['senha_hash'], PASSWORD_DEFAULT)) {
            Database::exec('UPDATE usuario SET senha_hash = :h WHERE id = :id', ['h' => password_hash($senha, PASSWORD_DEFAULT), 'id' => $row['id']]);
        }
        Database::exec('DELETE FROM tentativa_login WHERE identificador = :i AND ip = :ip', ['i' => $ident, 'ip' => $req->ip()]);

        return Response::ok(['usuario' => Auth::login($row)]);
    }

    /** GET auth/me */
    public function me(Request $req, array $params, array $user): Response
    {
        return Response::ok($user);
    }

    /** POST auth/logout */
    public function logout(): Response
    {
        Auth::logout();
        return Response::ok(null);
    }

    /** PUT auth/senha  { senhaAtual, novaSenha } — o usuário troca a própria senha. */
    public function alterarSenha(Request $req, array $params, array $user): Response
    {
        $body = $req->body();
        $atual = (string) ($body['senhaAtual'] ?? '');
        $nova = (string) ($body['novaSenha'] ?? '');

        $row = Database::one('SELECT senha_hash FROM usuario WHERE id = :id', ['id' => $user['id']]);
        $erros = [];
        if (!password_verify($atual, $row['senha_hash'])) {
            $erros['senhaAtual'] = 'Senha atual incorreta.';
        }
        if (mb_strlen($nova) < 8) {
            $erros['novaSenha'] = 'A nova senha deve ter pelo menos 8 caracteres.';
        } elseif ($nova === $atual) {
            $erros['novaSenha'] = 'A nova senha deve ser diferente da atual.';
        }
        if ($erros) {
            throw ApiException::validation($erros);
        }

        Database::exec('UPDATE usuario SET senha_hash = :h, senha_provisoria = 0 WHERE id = :id', ['h' => password_hash($nova, PASSWORD_DEFAULT), 'id' => $user['id']]);
        return Response::ok(null);
    }

    private function exigirLimite(string $ident, string $ip): void
    {
        $janela = date('Y-m-d H:i:s', time() - 60 * (int) Config::get('login.janela_minutos', 10));
        Database::exec('DELETE FROM tentativa_login WHERE criada_em < :limite', ['limite' => $janela]);
        $falhas = (int) Database::value(
            'SELECT COUNT(*) FROM tentativa_login WHERE identificador = :i AND ip = :ip AND criada_em >= :janela',
            ['i' => $ident, 'ip' => $ip, 'janela' => $janela],
        );
        if ($falhas >= (int) Config::get('login.max_tentativas', 5)) {
            throw new ApiException(429, 'too_many_attempts', 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.');
        }
    }

    private function registrarFalha(string $ident, string $ip): void
    {
        Database::insert('INSERT INTO tentativa_login (identificador, ip, criada_em) VALUES (:i, :ip, :t)', ['i' => mb_substr($ident, 0, 150), 'ip' => $ip, 't' => Fmt::agora()]);
    }
}
