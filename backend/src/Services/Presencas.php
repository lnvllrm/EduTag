<?php
declare(strict_types=1);

namespace EduTag\Services;

use EduTag\Core\Escopo;
use EduTag\Core\Fmt;
use EduTag\Core\Request;
use EduTag\Core\Validator;

/**
 * Consulta de presenças (tabela `registro`) compartilhada por presenças, relatórios,
 * dashboard e frequência do aluno. Concentra a regra de visibilidade:
 * o ALUNO enxerga somente os próprios registros, ignorando qualquer filtro de aluno da URL.
 */
final class Presencas
{
    public const FROM = 'registro r
        JOIN aula a ON a.id = r.aula_id
        JOIN turma t ON t.id = a.turma_id
        JOIN disciplina di ON di.id = t.disciplina_id
        JOIN usuario u ON u.id = r.usuario_id
        LEFT JOIN dispositivo d ON d.id = r.dispositivo_id';

    public const SELECT = 'r.id, r.status, r.data_hora_leitura, r.origem, r.dispositivo_id, d.nome AS dispositivo_nome,
        u.id AS aluno_id, u.nome AS aluno_nome, u.ra AS aluno_ra,
        a.id AS aula_id, a.`data` AS aula_data, a.inicio AS aula_inicio, a.fim AS aula_fim,
        t.id AS turma_id, t.codigo AS turma_codigo, t.nome AS turma_nome,
        di.id AS disciplina_id, di.nome AS disciplina_nome, di.codigo AS disciplina_codigo';

    /**
     * Condições de WHERE a partir dos filtros da URL e do usuário.
     * @return array{0:list<string>,1:array}
     */
    public static function filtros(Request $req, array $user): array
    {
        $where = [];
        $params = [];

        [$escW, $escP] = Escopo::turma($user);
        $where = array_merge($where, $escW);
        $params += $escP;
        if ($user['perfil'] === 'aluno') {
            $where[] = 'r.usuario_id = :f_uid';
            $params['f_uid'] = $user['id'];
        } elseif (($v = $req->queryInt('alunoId')) !== null) {
            $where[] = 'r.usuario_id = :f_aluno';
            $params['f_aluno'] = $v;
        }
        foreach (['aulaId' => 'r.aula_id', 'turmaId' => 't.id', 'disciplinaId' => 'di.id'] as $key => $col) {
            if (($v = $req->queryInt($key)) !== null) {
                $where[] = "$col = :f_$key";
                $params["f_$key"] = $v;
            }
        }
        if (($status = $req->queryString('status')) !== null) {
            $where[] = 'r.status = :f_status';
            $params['f_status'] = Fmt::presencaDb($status);
        }
        foreach (['de' => '>=', 'ate' => '<='] as $key => $op) {
            $v = $req->queryString($key);
            if ($v !== null && Validator::isDate($v)) {
                $where[] = "a.`data` $op :f_$key";
                $params["f_$key"] = $v;
            }
        }
        return [$where, $params];
    }

    /** Linha do banco → objeto da API. */
    public static function view(array $r): array
    {
        return [
            'id'           => (int) $r['id'],
            'status'       => Fmt::presenca($r['status']),
            'registradoEm' => Fmt::dataHora($r['data_hora_leitura']),
            'origem'       => $r['origem'],
            'dispositivo'  => $r['dispositivo_id'] ? ['id' => (int) $r['dispositivo_id'], 'nome' => $r['dispositivo_nome']] : null,
            'aluno'        => ['id' => (int) $r['aluno_id'], 'nome' => $r['aluno_nome'], 'matricula' => $r['aluno_ra']],
            'aula'         => ['id' => (int) $r['aula_id'], 'data' => $r['aula_data'], 'inicio' => Fmt::hora($r['aula_inicio']), 'fim' => Fmt::hora($r['aula_fim'])],
            'turma'        => ['id' => (int) $r['turma_id'], 'codigo' => $r['turma_codigo'], 'nome' => $r['turma_nome']],
            'disciplina'   => ['id' => (int) $r['disciplina_id'], 'nome' => $r['disciplina_nome']],
        ];
    }
}
