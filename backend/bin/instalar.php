<?php
/**
 * Instala o banco do EduTag.
 *
 *   php backend/bin/instalar.php              cria o banco e as tabelas (se ainda não existirem)
 *   php backend/bin/instalar.php --demo       idem + dados de demonstração (apenas se o banco estiver vazio)
 *   php backend/bin/instalar.php --recriar    APAGA o banco inteiro e recria (pede confirmação)
 *
 * No XAMPP:  C:\xampp\php\php.exe backend\bin\instalar.php --demo
 * Lê a conexão de backend/config/config.php (ou config.example.php).
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Execute pela linha de comando.\n");
}
require __DIR__ . '/../src/bootstrap.php';

use EduTag\Core\Config;
use EduTag\Core\Database;
use EduTag\Services\DemoData;

$args = array_slice($argv, 1);
$demo = in_array('--demo', $args, true);
$recriar = in_array('--recriar', $args, true);
$c = Config::get('db');

if (!preg_match('/^\w+$/', $c['name'])) {
    exit("Nome de banco inválido em config.php.\n");
}

try {
    $pdo = new PDO(sprintf('mysql:host=%s;port=%d;charset=%s', $c['host'], $c['port'], $c['charset']), $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    exit("Não foi possível conectar ao MySQL em {$c['host']}:{$c['port']} ({$e->getMessage()}).\nConfira se o MySQL está ligado e o config.php.\n");
}

if ($recriar) {
    fwrite(STDOUT, "ATENÇÃO: isto APAGA o banco '{$c['name']}' e todos os dados. Digite o nome do banco para confirmar: ");
    if (trim((string) fgets(STDIN)) !== $c['name']) {
        exit("Cancelado.\n");
    }
    $pdo->exec("DROP DATABASE IF EXISTS `{$c['name']}`");
}

// O schema.sql define o banco "chamada_rfid"; se config.php usar outro nome, ajusta.
$sql = file_get_contents(__DIR__ . '/../../database/schema.sql');
$sql = preg_replace('/--.*$/m', '', $sql);                                   // remove comentários
$sql = str_replace('chamada_rfid', $c['name'], $sql);
foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
    $pdo->exec($statement);
}
echo "Banco '{$c['name']}' pronto (tabelas criadas/verificadas).\n";

if ($demo) {
    Database::reset();
    if ((int) Database::value('SELECT COUNT(*) FROM usuario') > 0) {
        exit("O banco já tem usuários; dados de demonstração NÃO foram inseridos (use --recriar para começar do zero).\n");
    }
    $r = DemoData::gerar();
    echo "Dados de demonstração inseridos: {$r['alunos']} alunos, {$r['aulas']} aulas, {$r['registros']} registros.\n";
    echo "Senha de todas as contas de demonstração: " . DemoData::DEMO_SENHA . "\n";
    echo "  Professor: carla.mendes@edutag.edu.br   Aluno: ana.souza@aluno.edutag.edu.br   Admin: admin@edutag.edu.br\n";
    echo "Token do leitor ET-RDR-01 (SOMENTE demonstração): {$r['tokenLeitor']}\n";
} else {
    echo "Crie o primeiro acesso com:  php backend/bin/criar-usuario.php\n";
}
