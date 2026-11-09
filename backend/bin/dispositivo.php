<?php
/**
 * Cadastra um leitor RFID e gera o token que o Arduino usará.
 *
 *   php backend/bin/dispositivo.php --codigo=ET-RDR-01 --nome="Leitor — Sala 201" --local="Sala 201"
 *   php backend/bin/dispositivo.php --codigo=ET-RDR-01 --novo-token      (gera outro token para um leitor existente)
 *
 * O token aparece UMA vez, aqui. No banco fica só o hash SHA-256.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Execute pela linha de comando.\n");
}
require __DIR__ . '/../src/bootstrap.php';

use EduTag\Core\Database;

$opt = getopt('', ['codigo:', 'nome:', 'local:', 'novo-token']);
if (empty($opt['codigo'])) {
    exit("Uso: php backend/bin/dispositivo.php --codigo=ET-RDR-01 --nome=\"...\" --local=\"...\"  [ou --codigo=... --novo-token]\n");
}

$token = bin2hex(random_bytes(24)); // 48 caracteres hex = 192 bits
$hash = hash('sha256', $token);

$existente = Database::one('SELECT id FROM dispositivo WHERE codigo = :c', ['c' => $opt['codigo']]);
if ($existente) {
    if (!isset($opt['novo-token'])) {
        exit("O dispositivo {$opt['codigo']} já existe. Use --novo-token para gerar outro token.\n");
    }
    Database::exec('UPDATE dispositivo SET token_hash = :h WHERE id = :id', ['h' => $hash, 'id' => $existente['id']]);
    echo "Novo token gerado para {$opt['codigo']} (o anterior deixou de valer).\n";
} else {
    if (empty($opt['nome']) || empty($opt['local'])) {
        exit("Para cadastrar, informe também --nome e --local.\n");
    }
    Database::insert(
        'INSERT INTO dispositivo (codigo, nome, `local`, token_hash, ativo) VALUES (:c, :n, :l, :h, 1)',
        ['c' => $opt['codigo'], 'n' => $opt['nome'], 'l' => $opt['local'], 'h' => $hash],
    );
    echo "Dispositivo {$opt['codigo']} cadastrado.\n";
}
echo "TOKEN (guarde agora; não será exibido novamente):\n$token\n";
