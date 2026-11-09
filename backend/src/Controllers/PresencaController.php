<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\Database;
use EduTag\Core\Paginator;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Services\Frequencia;
use EduTag\Services\Presencas;

final class PresencaController
{
    /** GET presencas — somente leitura. O aluno só enxerga os próprios registros. */
    public function listar(Request $req, array $p, array $user): Response
    {
        [$where, $params] = Presencas::filtros($req, $user);

        $q = $req->queryString('q');
        $searchWhere = $where;
        $searchParams = $params;
        if ($q !== null && $user['perfil'] !== 'aluno') {
            $searchWhere[] = '(u.nome LIKE :f_q1 OR u.ra LIKE :f_q2)';
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $searchParams += ['f_q1' => $like, 'f_q2' => $like];
        }

        // O resumo cobre TODO o conjunto filtrado (não só a página atual).
        $whereSql = $searchWhere ? 'WHERE ' . implode(' AND ', $searchWhere) : '';
        $resumo = Database::one('SELECT ' . Frequencia::sqlContagens() . ' FROM ' . Presencas::FROM . " $whereSql", $searchParams);

        // A busca textual já foi aplicada acima; não deixa o Paginator aplicá-la de novo.
        [$rows, $meta] = Paginator::run($this->semBusca($req), Presencas::SELECT, Presencas::FROM, $searchWhere, $searchParams, [
            'sortable'    => [
                'aula.data' => 'a.`data`', 'aluno.nome' => 'u.nome', 'status' => 'r.status',
                'turma.codigo' => 't.codigo', 'registradoEm' => 'r.data_hora_leitura',
            ],
            'defaultSort'  => 'aula.data',
            'defaultOrder' => 'desc',
            'tieBreaker'   => 'a.inicio DESC, u.nome, r.id',
        ]);

        return Response::ok(array_map([Presencas::class, 'view'], $rows), $meta + ['resumo' => Frequencia::resumo($resumo)]);
    }

    private function semBusca(Request $req): Request
    {
        $query = $req->query;
        unset($query['q']);
        return $req->withQuery($query);
    }
}
