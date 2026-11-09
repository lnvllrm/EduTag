<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\Database;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Services\Frequencia;
use EduTag\Services\Presencas;

final class RelatorioController
{
    /** GET relatorios/frequencia?turmaId=&disciplinaId=&de=&ate= → linhas por aluno × turma + meta.{resumo, porTurma} */
    public function frequencia(Request $req, array $p, array $user): Response
    {
        [$where, $params] = Presencas::filtros($req, $user);
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $linhas = Database::all(
            'SELECT u.id AS aluno_id, u.nome, u.ra, t.id AS turma_id, t.codigo AS turma_codigo, di.nome AS disciplina_nome, ' . Frequencia::sqlContagens() . '
               FROM ' . Presencas::FROM . "
               $whereSql
              GROUP BY u.id, u.nome, u.ra, t.id, t.codigo, di.nome
              ORDER BY u.nome, t.codigo, u.id",
            $params,
        );
        $totalAulas = (int) Database::value('SELECT COUNT(DISTINCT r.aula_id) FROM ' . Presencas::FROM . " $whereSql", $params);

        $data = [];
        $porTurma = [];
        foreach ($linhas as $l) {
            $f = Frequencia::calcular($l);
            $data[] = [
                'alunoId' => (int) $l['aluno_id'], 'nome' => $l['nome'], 'matricula' => $l['ra'],
                'turmaId' => (int) $l['turma_id'], 'turma' => $l['turma_codigo'], 'disciplina' => $l['disciplina_nome'],
            ] + $f;
            $porTurma[$l['turma_id']]['linhas'][] = $l;
            $porTurma[$l['turma_id']]['codigo'] = $l['turma_codigo'];
            $porTurma[$l['turma_id']]['disciplina'] = $l['disciplina_nome'];
        }

        $turmas = [];
        foreach ($porTurma as $turmaId => $t) {
            $turmas[] = [
                'turmaId' => (int) $turmaId, 'codigo' => $t['codigo'], 'disciplina' => $t['disciplina'],
                'alunos' => count($t['linhas']),
            ] + Frequencia::calcular(Frequencia::somar($t['linhas']));
        }
        usort($turmas, static fn ($a, $b) => strcmp($a['codigo'], $b['codigo']));

        $geral = Frequencia::calcular(Frequencia::somar($linhas));
        return Response::ok($data, [
            'resumo' => [
                'alunos'   => count(array_unique(array_column($data, 'alunoId'))),
                'aulas'    => $totalAulas,
                'pctMedio' => $geral['pct'],
                'emRisco'  => count(array_filter($data, static fn ($l) => $l['situacao'] === 'risco')),
            ],
            'porTurma' => $turmas,
        ]);
    }
}
