<?php
/**
 * Cria um usuário pelo terminal (ex.: o primeiro professor/administrador).
 *
 *   php backend/bin/criar-usuario.php --tipo=administrador --ra=ADM01 --nome="Maria Silva" --email=maria@escola.edu.br
 *
 * A senha é pedida no prompt (não vai para o histórico do terminal).
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Execute pela linha de comando.\n");
}
require __DIR__ . '/../src/bootstrap.php';

use EduTag\Core\Database;
use EduTag\Core\Fmt;

$opt = getopt('', ['tipo:', 'ra:', 'nome:', 'email:']);
foreach (['tipo', 'ra', 'nome', 'email'] as $k) {
    if (empty($opt[$k])) {
        exit("Uso: php backend/bin/criar-usuario.php --tipo=professor|administrador|aluno --ra=... --nome=\"...\" --email=...\n");
    }
}
if (!in_array($opt['tipo'], ['aluno', 'professor', 'administrador'], true)) {
    exit("Tipo inválido.\n");
}
if (!filter_var($opt['email'], FILTER_VALIDATE_EMAIL)) {
    exit("E-mail inválido.\n");
}

echo 'Senha (mín. 8 caracteres): ';
if (DIRECTORY_SEPARATOR === '/') {
    system('stty -echo');
}
$senha = trim((string) fgets(STDIN));
if (DIRECTORY_SEPARATOR === '/') {
    system('stty echo');
    echo "\n";
}
if (mb_strlen($senha) < 8) {
    exit("Senha muito curta.\n");
}

try {
    $id = Database::insert(
        'INSERT INTO usuario (ra, nome, tipo, senha_hash, ativo, email, criado_em) VALUES (:ra, :nome, :tipo, :h, 1, :email, :t)',
        ['ra' => $opt['ra'], 'nome' => $opt['nome'], 'tipo' => $opt['tipo'], 'h' => password_hash($senha, PASSWORD_DEFAULT), 'email' => mb_strtolower($opt['email']), 't' => Fmt::agora()],
    );
    echo "Usuário #$id criado.\n";
} catch (PDOException $e) {
    exit(Database::isDuplicate($e) ? "Já existe um usuário com esta matrícula ou e-mail.\n" : "Erro: {$e->getMessage()}\n");
}
