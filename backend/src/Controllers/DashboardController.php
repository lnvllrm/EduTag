<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\Database;
use EduTag\Core\Escopo;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Services\Frequencia;

/**
 * GET dashboard — painel da equipe. O administrador vê tudo; o professor, só as turmas dele
 * (e não recebe dados de dispositivos). O painel do aluno é montado no front com alunos/{id}/frequencia + aulas.
 */
final class DashboardController
{
    public function resumo(Request $req, array $p, array $user): Response
    {
        $hoje = date('Y-m-d');
        $agora = date('Y-m-d H:i:s');
        $admin = $user['perfil'] === 'administrador';

        // Condições de escopo para consultas que já têm a turma aliasada como "t".
        [$escW, $escP] = Escopo::turma($user);
        $and = $escW ? ' AND ' . implode(' AND ', $escW) : '';
        $where = $escW ? ' WHERE ' . implode(' AND ', $escW) : '';

        $geral = Database::one(
            'SELECT ' . Frequencia::sqlContagens() . ' FROM registro r JOIN aula a ON a.id = r.aula_id JOIN turma t ON t.id = a.turma_id' . $where,
            $escP,
        );

        $disp = $admin ? Database::all('SELECT ultima_comunicacao, ativo FROM dispositivo') : [];
        $online = count(array_filter($disp, static fn ($d) => DispositivoController::status($d['ultima_comunicacao'], (bool) $d['ativo']) === 'online'));

        $kpis = [
            'alunosAtivos'       => (int) Database::value(
                "SELECT COUNT(DISTINCT u.id) FROM usuario u JOIN matricula m ON m.usuario_id = u.id JOIN turma t ON t.id = m.turma_id
                  WHERE u.tipo = 'aluno' AND u.ativo = 1" . $and,
                $escP,
            ),
            'turmas'             => (int) Database::value('SELECT COUNT(*) FROM turma t' . $where, $escP),
            'aulasHoje'          => (int) Database::value(
                "SELECT COUNT(*) FROM aula a JOIN turma t ON t.id = a.turma_id WHERE a.`data` = :hoje AND a.status <> 'cancelada'" . $and,
                ['hoje' => $hoje] + $escP,
            ),
            'presencaMediaPct'   => Frequencia::calcular($geral)['pct'],
            'dispositivosOnline' => $online,
            'dispositivosTotal'  => count($disp),
        ];

        // Últimas 8 datas com registro de presença (em ordem cronológica).
        $dias = Database::all(
            'SELECT a.`data`, ' . Frequencia::sqlContagens() . '
               FROM registro r JOIN aula a ON a.id = r.aula_id JOIN turma t ON t.id = a.turma_id' . $where . '
              GROUP BY a.`data` ORDER BY a.`data` DESC LIMIT 8',
            $escP,
        );
        $presencaPorDia = array_map(static fn ($d) => ['data' => $d['data']] + Frequencia::resumo($d), array_reverse($dias));

        $turmas = Database::all(
            'SELECT t.id, t.codigo, di.nome AS disciplina_nome, (SELECT COUNT(*) FROM matricula m WHERE m.turma_id = t.id) AS total_alunos, ' . Frequencia::sqlContagens() . '
               FROM turma t
               JOIN disciplina di ON di.id = t.disciplina_id
               LEFT JOIN aula a ON a.turma_id = t.id
               LEFT JOIN registro r ON r.aula_id = a.id' . $where . '
              GROUP BY t.id, t.codigo, di.nome ORDER BY t.codigo',
            $escP,
        );
        $frequenciaTurmas = array_map(static fn ($t) => [
            'id' => (int) $t['id'], 'codigo' => $t['codigo'], 'disciplina' => $t['disciplina_nome'], 'totalAlunos' => (int) $t['total_alunos'],
        ] + Frequencia::calcular($t), $turmas);

        $alunos = Database::all(
            'SELECT u.id, u.nome, u.ra, ' . Frequencia::sqlContagens() . "
               FROM usuario u
               JOIN registro r ON r.usuario_id = u.id
               JOIN aula a ON a.id = r.aula_id
               JOIN turma t ON t.id = a.turma_id
              WHERE u.tipo = 'aluno' AND u.ativo = 1" . $and . ' GROUP BY u.id, u.nome, u.ra',
            $escP,
        );
        $atencao = [];
        foreach ($alunos as $a) {
            $f = Frequencia::calcular($a);
            if ($f['pct'] !== null && $f['pct'] < 85) {
                $atencao[] = ['id' => (int) $a['id'], 'nome' => $a['nome'], 'matricula' => $a['ra']] + $f;
            }
        }
        usort($atencao, static fn ($x, $y) => $x['pct'] <=> $y['pct']);

        $proximas = Database::all(
            'SELECT ' . AulaController::SELECT . ' FROM ' . AulaController::FROM . "
              WHERE a.status IN ('agendada', 'em_andamento') AND CONCAT(a.`data`, ' ', a.fim) >= :agora" . $and . '
              ORDER BY a.`data`, a.inicio, a.id LIMIT 5',
            ['agora' => $agora] + $escP,
        );

        return Response::ok([
            'kpis'             => $kpis,
            'presencaPorDia'   => $presencaPorDia,
            'frequenciaTurmas' => $frequenciaTurmas,
            'alunosAtencao'    => array_slice($atencao, 0, 5),
            'proximasAulas'    => AulaController::views($proximas, ['perfil' => 'professor']),
            'ultimaAula'       => $this->ultimaAula($and, $escP),
            'leiturasRecentes' => $admin ? DispositivoController::ultimasLeituras(null, 6) : [],
        ]);
    }

    /** Chamada da última aula finalizada (das turmas do escopo): quem faltou. */
    private function ultimaAula(string $and, array $escP): ?array
    {
        $aula = Database::one(
            'SELECT ' . AulaController::SELECT . ' FROM ' . AulaController::FROM . "
              WHERE a.status = 'finalizada'" . $and . ' ORDER BY a.`data` DESC, a.inicio DESC, a.id DESC LIMIT 1',
            $escP,
        );
        if ($aula === null) {
            return null;
        }
        $ausentes = array_map(
            static fn ($r) => ['id' => (int) $r['id'], 'nome' => $r['nome'], 'matricula' => $r['ra']],
            Database::all(
                "SELECT u.id, u.nome, u.ra FROM registro r JOIN usuario u ON u.id = r.usuario_id WHERE r.aula_id = :aula AND r.status = 'ausente' ORDER BY u.nome",
                ['aula' => $aula['id']],
            ),
        );
        return [
            'aula'     => AulaController::views([$aula], ['perfil' => 'professor'])[0],
            'ausentes' => $ausentes,
        ];
    }
}
