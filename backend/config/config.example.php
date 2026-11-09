<?php
/**
 * EduTag — configuração do back-end.
 *
 * Copie este arquivo para `config.php` (ignorado pelo Git) e ajuste os valores.
 * Sem `config.php`, este arquivo é usado como padrão (serve ao XAMPP recém-instalado:
 * usuário `root` sem senha). Em qualquer servidor real, crie o `config.php`.
 */

declare(strict_types=1);

return [
    'app' => [
        // Em produção mantenha false: erros internos não são detalhados na resposta.
        'debug'    => false,
        'timezone' => 'America/Sao_Paulo',
        // Origens extras autorizadas a chamar a API com cookies (CORS).
        // Vazio = somente a mesma origem (front e API no mesmo servidor, o caso do XAMPP).
        // Ex.: ['http://localhost:8765']
        'allowed_origins' => [],
    ],

    'db' => [
        'host'    => '127.0.0.1',
        'port'    => 3306,
        'name'    => 'chamada_rfid',
        'user'    => 'root',
        'pass'    => '',
        'charset' => 'utf8mb4',
    ],

    'session' => [
        'name'     => 'edutag_sid',
        'lifetime' => 0,      // 0 = até fechar o navegador
        'idle_ttl' => 28800,  // segundos sem uso antes de a sessão expirar (8 h)
    ],

    'login' => [
        'max_tentativas' => 5,   // falhas por (usuário + IP) dentro da janela
        'janela_minutos' => 10,
    ],

    // Regra de situação da frequência (percentual de comparecimento).
    // >>> CONFIRMAR com a coordenação do curso. <<<
    'frequencia' => [
        'regular' => 85.0,  // >= regular  → "regular"
        'atencao' => 75.0,  // >= atencao  → "atencao"; abaixo → "risco"
    ],

    // Regras da leitura de tags (Arduino).
    'rfid' => [
        'minutos_antes_inicio'  => 15,  // aceita leitura a partir de N min antes da aula
        'tolerancia_atraso_min' => 15,  // depois disso (após o início) vira "atrasado"
        'minutos_apos_fim'      => 0,   // aceita leitura até N min depois do fim da aula
    ],

    // Estado do leitor derivado da última comunicação.
    'dispositivo' => [
        'online_seg'   => 120,  // comunicou há até 2 min → online
        'instavel_seg' => 900,  // até 15 min → instável; acima → offline
    ],

    // bin/encerrar-aulas.php: finaliza aulas que terminaram há mais de N minutos.
    'aulas' => [
        'encerrar_apos_min' => 30,
    ],
];
