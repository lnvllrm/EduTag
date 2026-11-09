<?php
/**
 * Teste de fumaça da API (ponta a ponta, via HTTP) — sem dependências.
 *
 *   php backend/tests/smoke.php [URL_DA_API]
 *   ex.: php backend/tests/smoke.php http://localhost/EduTag/backend/api
 *        php backend/tests/smoke.php http://localhost:8080/backend/api     (padrão)
 *
 * Requer o banco instalado COM os dados de demonstração (bin/instalar.php --demo).
 * Cria registros próprios (prefixo "ZZ Teste") e os remove ao final.
 * Não rode contra um banco de produção.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Execute pela linha de comando.\n");
}
require __DIR__ . '/../src/bootstrap.php';

use EduTag\Core\Database;

$base = rtrim($argv[1] ?? 'http://localhost:8080/backend/api', '/');
$DEMO_TOKEN = 'demo-' . str_repeat('0123456789abcdef', 3);

/* ----------------------------- mini cliente HTTP ----------------------------- */
final class Http
{
    public string $cookie = '';
    public function __construct(private string $base)
    {
    }

    /** @return array{0:int,1:array,2:array} [status, json, headers] */
    public function call(string $method, string $path, ?array $body = null, array $headers = []): array
    {
        $h = ['Accept: application/json'];
        if ($body !== null) {
            $h[] = 'Content-Type: application/json';
        }
        if ($this->cookie !== '') {
            $h[] = 'Cookie: ' . $this->cookie;
        }
        foreach ($headers as $k => $v) {
            $h[] = "$k: $v";
        }
        $ctx = stream_context_create(['http' => [
            'method' => $method, 'header' => implode("\r\n", $h), 'ignore_errors' => true, 'timeout' => 20,
            'content' => $body !== null ? json_encode($body) : '',
        ]]);
        $raw = file_get_contents($this->base . '/' . ltrim($path, '/'), false, $ctx);
        $responseHeaders = $http_response_header ?? [];
        preg_match('#HTTP/\S+\s+(\d+)#', $responseHeaders[0] ?? '', $m);
        foreach ($responseHeaders as $line) {
            if (stripos($line, 'Set-Cookie:') === 0 && preg_match('/Set-Cookie:\s*([^=]+)=([^;]*)/i', $line, $c)) {
                $this->cookie = $c[2] === 'deleted' || $c[2] === '' ? '' : "{$c[1]}={$c[2]}";
            }
        }
        return [(int) ($m[1] ?? 0), json_decode((string) $raw, true) ?? [], $responseHeaders];
    }

    public function login(string $email, string $senha = 'edutag123'): array
    {
        $this->cookie = '';
        return $this->call('POST', 'auth/login', ['email' => $email, 'senha' => $senha]);
    }
}

/* -------------------------------- asserções -------------------------------- */
$pass = 0;
$fail = 0;
function ok(bool $cond, string $label, mixed $detail = null): void
{
    global $pass, $fail;
    if ($cond) {
        $pass++;
        echo "  ✓ $label\n";
    } else {
        $fail++;
        echo "  ✗ $label" . ($detail !== null ? ' → ' . (is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)) : '') . "\n";
    }
}
function section(string $t): void
{
    echo "\n$t\n";
}

$prof = new Http($base);
$aluno = new Http($base);
$anon = new Http($base);

/* ============================== AUTENTICAÇÃO ============================== */
section('Autenticação');
[$s, $j] = $anon->call('GET', 'alunos');
ok($s === 401 && ($j['error']['code'] ?? '') === 'unauthenticated', 'sem sessão → 401', [$s, $j]);
[$s, $j] = $anon->call('POST', 'auth/login', ['email' => '', 'senha' => '']);
ok($s === 422 && isset($j['error']['fields']['email'], $j['error']['fields']['senha']), 'login vazio → 422 com campos', [$s, $j]);
[$s, $j] = $anon->call('POST', 'auth/login', ['email' => 'carla.mendes@edutag.edu.br', 'senha' => 'errada']);
ok($s === 401 && $j['error']['code'] === 'invalid_credentials', 'senha errada → 401', [$s, $j]);
[$s, $j] = $prof->login('carla.mendes@edutag.edu.br');
ok($s === 200 && $j['data']['usuario']['perfil'] === 'professor' && !isset($j['data']['usuario']['senha_hash']), 'login do professor', [$s, $j]);
[$s, $j] = $prof->call('GET', 'auth/me');
ok($s === 200 && $j['data']['email'] === 'carla.mendes@edutag.edu.br', 'auth/me');
[$s, $j] = $aluno->login('ana.souza@aluno.edutag.edu.br');
$anaId = $j['data']['usuario']['alunoId'] ?? 0;
ok($s === 200 && $j['data']['usuario']['perfil'] === 'aluno' && $anaId > 0, 'login do aluno (alunoId presente)', [$s, $j]);
$admin = new Http($base);
[$s, $j] = $admin->login('admin@edutag.edu.br');
ok($s === 200 && $j['data']['usuario']['perfil'] === 'professor' && $j['data']['usuario']['tipo'] === 'administrador', 'administrador entra com o perfil de professor', [$s, $j]);
$ra = new Http($base);
[$s] = $ra->login('P0002');
ok($s === 200, 'login também aceita a matrícula (RA)');
[$s, $j] = $anon->call('POST', 'auth/login', ['email' => 'a@b.c', 'senha' => 'x'], ['Origin' => 'http://evil.example']);
ok($s === 403 && $j['error']['code'] === 'forbidden_origin', 'POST de outra origem → 403 (CSRF)', [$s, $j]);
[$s] = $anon->call('GET', 'rota/inexistente');
ok($s === 404, 'rota inexistente → 404');
[$s] = $prof->call('DELETE', 'auth/me');
ok($s === 405, 'método não permitido → 405');

/* ============================== AUTORIZAÇÃO ============================== */
section('Autorização do aluno');
foreach (['alunos', 'disciplinas', 'dashboard', 'relatorios/frequencia', 'dispositivos', 'leituras', 'professores'] as $rota) {
    [$s] = $aluno->call('GET', $rota);
    ok($s === 403, "aluno em GET $rota → 403", $s);
}
[$s] = $aluno->call('POST', 'alunos', ['nome' => 'x']);
ok($s === 403, 'aluno não cadastra aluno');
[$s] = $aluno->call('GET', 'alunos/' . $anaId);
ok($s === 200, 'aluno vê o próprio cadastro');
[$s] = $aluno->call('GET', 'alunos/' . ($anaId + 1));
ok($s === 403, 'aluno NÃO vê o cadastro de outro');
[$s] = $aluno->call('GET', 'alunos/' . ($anaId + 1) . '/frequencia');
ok($s === 403, 'aluno NÃO vê a frequência de outro');
[$s, $j] = $aluno->call('GET', 'presencas', null);
$tudoDela = $s === 200 && $j['data'] && count(array_filter($j['data'], fn ($p) => $p['aluno']['id'] !== $anaId)) === 0;
ok($tudoDela, 'presenças do aluno: somente as dele', [$s, count($j['data'] ?? [])]);
[$s, $j] = $aluno->call('GET', 'presencas?alunoId=' . ($anaId + 1));
ok($s === 200 && count(array_filter($j['data'], fn ($p) => $p['aluno']['id'] !== $anaId)) === 0, 'filtro alunoId de outro é ignorado para o aluno');
[$s, $j] = $aluno->call('GET', 'aulas?perPage=100');
ok($s === 200 && $j['data'] && isset($j['data'][0]['presenca']) || array_key_exists('presenca', $j['data'][0] ?? []), 'aulas do aluno trazem `presenca`', [$s]);
ok(!isset($j['data'][0]['resumo']), 'aulas do aluno NÃO trazem o resumo da turma');
[$s, $jt] = $aluno->call('GET', 'turmas?perPage=100');
[$s2, $jtp] = $prof->call('GET', 'turmas?perPage=100');
ok($s === 200 && $jt['meta']['total'] < $jtp['meta']['total'] && $jt['meta']['total'] >= 2, 'aluno só vê as turmas em que está matriculado', [$jt['meta']['total'] ?? null, $jtp['meta']['total'] ?? null]);
[$s, $j] = $aluno->call('GET', "alunos/$anaId/frequencia");
ok($s === 200 && isset($j['data']['geral']['pct'], $j['data']['porTurma'][0]['disciplina']['nome']) && count($j['data']['historico']) > 0, 'frequência do aluno', $j['data']['geral'] ?? $j);

/* =============================== ALUNOS (CRUD) =============================== */
section('Alunos — CRUD e validações');
$novo = ['nome' => 'ZZ Teste Aluno', 'matricula' => 'ZZ0001', 'email' => 'zz.teste@aluno.edutag.edu.br', 'curso' => 'Sistemas de Informação', 'status' => 'ativo', 'tagUid' => 'zz:01 aa:bb'];
[$s, $j] = $prof->call('POST', 'alunos', ['nome' => '', 'matricula' => '', 'email' => 'invalido']);
ok($s === 422 && isset($j['error']['fields']['nome'], $j['error']['fields']['matricula'], $j['error']['fields']['email']), 'campos obrigatórios → 422', $j);
[$s, $j] = $prof->call('POST', 'alunos', $novo);
ok($s === 422 && isset($j['error']['fields']['tagUid']), 'UID não hexadecimal → 422', $j);
$novo['tagUid'] = 'a1:b2 c3-d4';
[$s, $j] = $prof->call('POST', 'alunos', $novo);
$zzId = $j['data']['id'] ?? 0;
ok($s === 201 && $j['data']['tagUid'] === 'A1B2C3D4' && $j['data']['status'] === 'ativo', 'cria aluno (UID normalizado)', [$s, $j]);
[$s, $j] = $prof->call('POST', 'alunos', $novo);
ok($s === 422 && isset($j['error']['fields']['matricula'], $j['error']['fields']['email'], $j['error']['fields']['tagUid']), 'matrícula, e-mail e tag duplicados → 422 por campo', $j);
[$s, $j] = $prof->call('PUT', "alunos/$zzId", ['nome' => 'ZZ Teste Aluno Editado'] + $novo);
ok($s === 200 && $j['data']['nome'] === 'ZZ Teste Aluno Editado', 'edita aluno');
[$s, $j] = $prof->call('GET', 'alunos?q=' . rawurlencode('zz teste') . '&tag=com&status=ativo');
ok($s === 200 && $j['meta']['total'] === 1, 'busca + filtros', $j['meta'] ?? $j);
[$s, $j] = $prof->call('GET', 'alunos?sort=totalTurmas&order=desc&perPage=3');
ok($s === 200 && count($j['data']) === 3 && $j['data'][0]['totalTurmas'] >= $j['data'][2]['totalTurmas'], 'ordenação por totalTurmas');
[$s, $j] = $prof->call('GET', 'alunos?sort=senha_hash;DROP');
ok($s === 200, 'sort fora da lista branca é ignorado (sem erro/injeção)');
[$s, $j] = $prof->call('GET', 'alunos/999999');
ok($s === 404, 'aluno inexistente → 404');
[$s, $j] = $prof->call('DELETE', "alunos/$anaId");
ok($s === 409, 'não exclui aluno com registros de presença → 409', $j);

/* ============================ DISCIPLINAS / TURMAS ============================ */
section('Disciplinas e turmas');
[$s, $j] = $prof->call('POST', 'disciplinas', ['nome' => '', 'codigo' => 'ROB101', 'cargaHoraria' => 0]);
ok($s === 422 && isset($j['error']['fields']['nome'], $j['error']['fields']['codigo'], $j['error']['fields']['cargaHoraria']), 'disciplina inválida/duplicada → 422', $j);
[$s, $j] = $prof->call('POST', 'disciplinas', ['nome' => 'ZZ Teste Disciplina', 'codigo' => 'zz999', 'cargaHoraria' => 40, 'descricao' => 'x']);
$dId = $j['data']['id'] ?? 0;
ok($s === 201 && $j['data']['codigo'] === 'ZZ999', 'cria disciplina', $j);
[$s, $j] = $prof->call('GET', 'professores');
$profId = $j['data'][0]['id'] ?? 0;
ok($s === 200 && $profId > 0, 'lista professores');

$turma = ['codigo' => 'zz-t1', 'nome' => 'ZZ Turma', 'disciplinaId' => $dId, 'professorId' => $profId, 'periodo' => '2026.2', 'diaSemana' => 2, 'inicio' => '10:00', 'fim' => '09:00', 'sala' => 'S1'];
[$s, $j] = $prof->call('POST', 'turmas', $turma);
ok($s === 422 && isset($j['error']['fields']['fim']), 'término antes do início → 422', $j);
$turma['fim'] = '11:00';
[$s, $j] = $prof->call('POST', 'turmas', $turma);
$tId = $j['data']['id'] ?? 0;
ok($s === 201 && $j['data']['codigo'] === 'ZZ-T1' && $j['data']['disciplina']['id'] === $dId && $j['data']['inicio'] === '10:00', 'cria turma', $j);
[$s, $j] = $prof->call('DELETE', "disciplinas/$dId");
ok($s === 409, 'disciplina com turma não é excluída → 409');
[$s, $j] = $prof->call('PUT', "turmas/$tId/alunos", ['alunoIds' => [$zzId, 999999]]);
ok($s === 422, 'matricular aluno inexistente → 422');
[$s, $j] = $prof->call('PUT', "turmas/$tId/alunos", ['alunoIds' => [$zzId]]);
ok($s === 200 && $j['data']['total'] === 1, 'matricula alunos na turma');
[$s, $j] = $prof->call('GET', "turmas/$tId/alunos");
ok($s === 200 && count($j['data']) === 1 && $j['data'][0]['id'] === $zzId, 'lista alunos da turma');

/* ======================== AULAS, CHAMADA E RFID ======================== */
section('Aulas e ciclo da chamada');
$hoje = date('Y-m-d');
$ini = date('H:i', time() - 300);     // começou há 5 min
$fim = date('H:i', time() + 3600);    // termina em 1 h
if ($ini > $fim) { // virada de dia: o teste de horário precisa de uma janela no mesmo dia
    echo "  (teste de RFID ignorado: muito perto da meia-noite)\n";
}
[$s, $j] = $prof->call('POST', 'aulas', ['turmaId' => $tId, 'data' => $hoje, 'inicio' => '10:00', 'fim' => '09:00']);
ok($s === 422 && isset($j['error']['fields']['fim']), 'aula com término antes do início → 422');
[$s, $j] = $prof->call('POST', 'aulas', ['turmaId' => $tId, 'data' => $hoje, 'inicio' => $ini, 'fim' => $fim, 'tema' => 'ZZ aula', 'status' => 'agendada']);
$aId = $j['data']['id'] ?? 0;
ok($s === 201 && $j['data']['resumo']['total'] === 0, 'cria aula (agendada)', $j);

// --- RFID
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => 'A1B2C3D4']);
ok($s === 401 && $j['error']['code'] === 'invalid_device_token', 'leitura sem token → 401');
[$s] = $anon->call('POST', 'rfid/leitura', ['uid' => 'A1B2C3D4'], ['Authorization' => 'Bearer token-errado-token-errado']);
ok($s === 401, 'leitura com token inválido → 401');
$dev = ['Authorization' => 'Bearer ' . $DEMO_TOKEN];
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => 'xyz'], $dev);
ok($s === 422, 'UID inválido → 422');
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => 'FFFFFFFF'], $dev);
ok($s === 200 && $j['data']['resultado'] === 'tag_desconhecida', 'tag desconhecida', $j);
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => 'a1:b2:c3:d4'], $dev);
ok($s === 200 && $j['data']['resultado'] === 'registrada' && $j['data']['status'] === 'presente' && $j['data']['aluno']['nome'] === 'ZZ Teste Aluno Editado', 'leitura dentro do horário → presente', $j);
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => 'A1B2C3D4'], $dev);
ok($s === 200 && $j['data']['resultado'] === 'duplicada', 'segunda leitura → duplicada', $j);
[$s, $j] = $prof->call('GET', "aulas?turmaId=$tId");
ok($s === 200 && $j['data'][0]['status'] === 'em_andamento' && $j['data'][0]['resumo']['presentes'] === 1, 'aula passou a "em andamento" e o resumo reflete a presença', $j['data'][0] ?? $j);
[$s, $j] = $prof->call('GET', "presencas?aulaId=$aId");
ok($s === 200 && $j['meta']['resumo']['presentes'] === 1 && $j['data'][0]['origem'] === 'rfid' && $j['data'][0]['dispositivo']['nome'] !== '', 'presença gravada com origem RFID e dispositivo');
[$s, $j] = $prof->call('GET', 'leituras?limit=5');
ok($s === 200 && $j['data'][0]['resultado'] === 'duplicada', 'log de leituras registra todas as tentativas', $j['data'][0] ?? null);
[$s, $j] = $prof->call('GET', 'dispositivos');
$d1 = array_values(array_filter($j['data'] ?? [], fn ($d) => $d['codigo'] === 'ET-RDR-01'))[0] ?? [];
ok(($d1['status'] ?? '') === 'online' && ($d1['leiturasHoje'] ?? 0) >= 3 && !isset($d1['token_hash']), 'dispositivo online, contagem do dia, sem vazar o hash do token', $d1);

// --- atraso e fora do horário
[$s, $j] = $prof->call('POST', 'alunos', ['nome' => 'ZZ Teste Atrasado', 'matricula' => 'ZZ0002', 'email' => 'zz.atrasado@aluno.edutag.edu.br', 'tagUid' => '0A0B0C0D']);
$zz2 = $j['data']['id'] ?? 0;
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => '0A0B0C0D'], $dev);
ok($s === 200 && $j['data']['resultado'] === 'fora_de_horario', 'aluno sem turma/aula → fora do horário', $j);
$prof->call('PUT', "turmas/$tId/alunos", ['alunoIds' => [$zzId, $zz2]]);
[$s, $j] = $prof->call('PUT', "aulas/$aId", ['turmaId' => $tId, 'data' => $hoje, 'inicio' => date('H:i', time() - 40 * 60), 'fim' => $fim, 'tema' => 'ZZ aula', 'status' => 'em_andamento']);
ok($s === 200, 'ajusta início da aula para 40 min atrás');
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => '0A0B0C0D'], $dev);
ok($s === 200 && $j['data']['resultado'] === 'registrada' && $j['data']['status'] === 'atrasado', 'leitura após a tolerância → atrasado', $j);

// --- finalização gera faltas
[$s, $j] = $prof->call('POST', 'alunos', ['nome' => 'ZZ Teste Faltoso', 'matricula' => 'ZZ0003', 'email' => 'zz.faltoso@aluno.edutag.edu.br']);
$zz3 = $j['data']['id'] ?? 0;
$prof->call('PUT', "turmas/$tId/alunos", ['alunoIds' => [$zzId, $zz2, $zz3]]);
[$s, $j] = $prof->call('GET', "aulas?turmaId=$tId");
$aulaAtual = $j['data'][0];
[$s, $j] = $prof->call('PUT', "aulas/$aId", ['turmaId' => $tId, 'data' => $aulaAtual['data'], 'inicio' => $aulaAtual['inicio'], 'fim' => $aulaAtual['fim'], 'tema' => 'ZZ aula', 'status' => 'realizada']);
ok($s === 200 && $j['data']['status'] === 'realizada' && $j['data']['resumo'] === ['presentes' => 1, 'atrasados' => 1, 'faltas' => 1, 'justificados' => 0, 'total' => 3], 'finalizar a aula gera "falta" para quem não passou a tag', $j['data']['resumo'] ?? $j);
[$s, $j] = $prof->call('GET', "presencas?aulaId=$aId&status=falta");
ok($s === 200 && count($j['data']) === 1 && $j['data'][0]['origem'] === 'sistema' && $j['data'][0]['aluno']['id'] === $zz3, 'filtro por status "falta"');
[$s, $j] = $anon->call('POST', 'rfid/leitura', ['uid' => 'A1B2C3D4'], $dev);
ok($j['data']['resultado'] === 'fora_de_horario', 'aula finalizada não aceita mais leituras');
[$s, $j] = $prof->call('DELETE', "aulas/$aId");
ok($s === 409, 'aula com presenças reais não é excluída → 409', $j);
[$s, $j] = $prof->call('GET', 'dashboard');
ok($s === 200 && isset($j['data']['kpis']['alunosAtivos'], $j['data']['presencaPorDia'], $j['data']['ultimaAula']['aula'], $j['data']['frequenciaTurmas'][0]['situacao']), 'dashboard completo', array_keys($j['data'] ?? []));
ok(count($j['data']['ultimaAula']['ausentes'] ?? []) >= 0 && isset($j['data']['proximasAulas']), 'dashboard: ultimaAula e proximasAulas');
[$s, $j] = $prof->call('GET', 'relatorios/frequencia');
ok($s === 200 && count($j['data']) > 20 && isset($j['meta']['resumo']['pctMedio'], $j['meta']['porTurma'][0]['codigo']), 'relatório de frequência', $j['meta']['resumo'] ?? null);
[$s, $j] = $prof->call('GET', "relatorios/frequencia?turmaId=$tId");
ok($s === 200 && count($j['data']) === 3 && $j['meta']['resumo']['aulas'] === 1, 'relatório filtrado por turma');

// --- encerramento automático
[$s, $j] = $prof->call('POST', 'aulas', ['turmaId' => $tId, 'data' => date('Y-m-d', time() - 86400), 'inicio' => '08:00', 'fim' => '09:00', 'status' => 'agendada']);
$aOld = $j['data']['id'] ?? 0;
require_once __DIR__ . '/../src/Services/AulaService.php';
$n = \EduTag\Services\AulaService::encerrarVencidas();
[$s, $j] = $prof->call('GET', "presencas?aulaId=$aOld");
ok($n >= 1 && count($j['data']) === 3 && $j['meta']['resumo']['faltas'] === 3, 'encerrarVencidas finaliza aula antiga e lança as faltas', [$n, $j['meta']['resumo'] ?? null]);

// --- reabrir desfaz as ausências do sistema
[$s, $j] = $prof->call('PUT', "aulas/$aOld", ['turmaId' => $tId, 'data' => date('Y-m-d', time() - 86400), 'inicio' => '08:00', 'fim' => '09:00', 'status' => 'agendada']);
ok($s === 200 && $j['data']['resumo']['total'] === 0, 'reabrir a aula remove as faltas geradas pelo sistema');
[$s] = $prof->call('DELETE', "aulas/$aOld");
ok($s === 200, 'aula sem presenças reais pode ser excluída');

/* ============================ SENHA E LIMITE DE LOGIN ============================ */
section('Senha e proteção contra força bruta');
$tmp = new Http($base);
[$s] = $tmp->login('zz.teste@aluno.edutag.edu.br', 'ZZ0001');
ok($s === 200, 'aluno novo entra com senha inicial = matrícula');
[$s, $j] = $tmp->call('GET', 'auth/me');
ok($j['data']['senhaProvisoria'] === true, 'senha inicial é marcada como provisória');
[$s, $j] = $tmp->call('PUT', 'auth/senha', ['senhaAtual' => 'errada', 'novaSenha' => 'curta']);
ok($s === 422 && isset($j['error']['fields']['senhaAtual'], $j['error']['fields']['novaSenha']), 'troca de senha valida atual e tamanho mínimo');
[$s] = $tmp->call('PUT', 'auth/senha', ['senhaAtual' => 'ZZ0001', 'novaSenha' => 'NovaSenha#2026']);
ok($s === 200, 'troca de senha');
[$s] = (new Http($base))->login('zz.teste@aluno.edutag.edu.br', 'ZZ0001');
ok($s === 401, 'senha antiga deixa de valer');
[$s, $j] = $tmp->call('GET', 'auth/me');
ok($j['data']['senhaProvisoria'] === false, 'senhaProvisoria some após a troca');
[$s] = $tmp->call('POST', 'auth/logout');
[$s] = $tmp->call('GET', 'auth/me');
ok($s === 401, 'logout encerra a sessão');

$brute = new Http($base);
$codigo = 0;
for ($i = 0; $i < 7; $i++) {
    [$codigo] = $brute->login('forca.bruta@teste.local', 'x' . $i);
}
ok($codigo === 429, 'após várias falhas, login é bloqueado temporariamente → 429', $codigo);
Database::exec("DELETE FROM tentativa_login WHERE identificador = 'forca.bruta@teste.local'");

/* ================================== LIMPEZA ================================== */
section('Limpeza');
$ids = implode(',', array_filter([$zzId, $zz2, $zz3]));
Database::exec("DELETE FROM leitura_rfid WHERE usuario_id IN ($ids) OR uid IN ('FFFFFFFF', 'A1B2C3D4', '0A0B0C0D')");
Database::exec("DELETE FROM registro WHERE usuario_id IN ($ids)");
Database::exec("DELETE FROM aula WHERE turma_id = $tId");
Database::exec("DELETE FROM matricula WHERE turma_id = $tId");
Database::exec("DELETE FROM turma WHERE id = $tId");
Database::exec("DELETE FROM disciplina WHERE id = $dId");
Database::exec("DELETE FROM usuario WHERE id IN ($ids)");
Database::exec("DELETE FROM tentativa_login WHERE identificador LIKE '%teste%' OR identificador LIKE 'zz.%'");
echo "  registros de teste removidos\n";

echo "\n" . ($fail === 0 ? "OK" : "FALHOU") . " — $pass passaram, $fail falharam\n";
exit($fail === 0 ? 0 : 1);
