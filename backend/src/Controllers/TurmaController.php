<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\ApiException;
use EduTag\Core\Database;
use EduTag\Core\Fmt;
use EduTag\Core\Paginator;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Core\Validator;

final class TurmaController
{
    private const SELECT = 't.id, t.codigo, t.nome, t.disciplina_id, t.professor_id, t.periodo, t.dia_semana, t.hora_inicio, t.hora_fim, t.sala,
        di.nome AS disciplina_nome, di.codigo AS disciplina_codigo, p.nome AS professor_nome,
        (SELECT COUNT(*) FROM matricula m WHERE m.turma_id = t.id) AS total_alunos';

    private const FROM = 'turma t JOIN disciplina di ON di.id = t.disciplina_id JOIN usuario p ON p.id = t.professor_id';

    /** GET turmas — o aluno recebe somente as turmas em que está matriculado. */
    public function listar(Request $req, array $p, array $user): Response
    {
        $where = [];
        $params = [];
        if ($user['perfil'] === 'aluno') {
            $where[] = 'EXISTS (SELECT 1 FROM matricula ms WHERE ms.turma_id = t.id AND ms.usuario_id = :f_uid)';
            $params['f_uid'] = $user['id'];
        }
        if (($d = $req->queryInt('disciplinaId')) !== null) {
            $where[] = 't.disciplina_id = :f_disc';
            $params['f_disc'] = $d;
        }

        [$rows, $meta] = Paginator::run($req, self::SELECT, self::FROM, $where, $params, [
            'search'      => ['t.codigo', 't.nome', 'di.nome', 'p.nome', 't.sala'],
            'sortable'    => [
                'codigo' => 't.codigo', 'nome' => 't.nome', 'disciplina.nome' => 'di.nome', 'professor.nome' => 'p.nome',
                'diaSemana' => 't.dia_semana', 'totalAlunos' => 'total_alunos',
            ],
            'defaultSort' => 'codigo',
            'tieBreaker'  => 't.id',
        ]);
        return Response::ok(array_map([self::class, 'view'], $rows), $meta);
    }

    public function criar(Request $req): Response
    {
        $d = $this->validar($req->body());
        try {
            $id = Database::insert(
                'INSERT INTO turma (codigo, nome, disciplina_id, professor_id, periodo, dia_semana, hora_inicio, hora_fim, sala)
                 VALUES (:codigo, :nome, :disc, :prof, :periodo, :dia, :ini, :fim, :sala)',
                $this->params($d),
            );
        } catch (\PDOException $e) {
            $this->duplicidade($e);
        }
        return Response::created(self::view($this->buscar($id)));
    }

    public function atualizar(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        $d = $this->validar($req->body(), $p['id']);
        try {
            Database::exec(
                'UPDATE turma SET codigo = :codigo, nome = :nome, disciplina_id = :disc, professor_id = :prof, periodo = :periodo,
                        dia_semana = :dia, hora_inicio = :ini, hora_fim = :fim, sala = :sala WHERE id = :id',
                $this->params($d) + ['id' => $p['id']],
            );
        } catch (\PDOException $e) {
            $this->duplicidade($e);
        }
        return Response::ok(self::view($this->buscar($p['id'])));
    }

    public function excluir(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        if (Database::value('SELECT 1 FROM aula WHERE turma_id = :id LIMIT 1', ['id' => $p['id']])) {
            throw ApiException::conflict('Não é possível excluir: a turma possui aulas cadastradas.');
        }
        Database::transaction(function () use ($p): void {
            Database::exec('DELETE FROM matricula WHERE turma_id = :id', ['id' => $p['id']]);
            Database::exec('DELETE FROM turma WHERE id = :id', ['id' => $p['id']]);
        });
        return Response::ok(null);
    }

    /** GET turmas/{id}/alunos */
    public function alunos(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        $rows = Database::all(
            "SELECT u.id, u.nome, u.ra AS matricula, u.email, u.curso, u.ativo, u.tag_uid, u.tag_vinculada_em,
                    (SELECT COUNT(*) FROM matricula m2 WHERE m2.usuario_id = u.id) AS total_turmas
               FROM matricula m JOIN usuario u ON u.id = m.usuario_id
              WHERE m.turma_id = :id ORDER BY u.nome, u.id",
            ['id' => $p['id']],
        );
        return Response::ok(array_map([AlunoController::class, 'view'], $rows));
    }

    /** PUT turmas/{id}/alunos  { alunoIds: [] } — substitui o conjunto de matriculados. */
    public function definirAlunos(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        $raw = $req->body()['alunoIds'] ?? [];
        if (!is_array($raw)) {
            throw ApiException::validation(['alunoIds' => 'Envie a lista de alunos.']);
        }
        $ids = array_values(array_unique(array_map('intval', array_filter($raw, static fn ($v) => is_int($v) || (is_string($v) && ctype_digit($v))))));

        if ($ids) {
            [$in, $inParams] = Database::in('a', $ids);
            $validos = (int) Database::value("SELECT COUNT(*) FROM usuario WHERE tipo = 'aluno' AND id IN ($in)", $inParams);
            if ($validos !== count($ids)) {
                throw ApiException::validation(['alunoIds' => 'A lista contém alunos inexistentes.']);
            }
        }

        Database::transaction(function () use ($p, $ids): void {
            if ($ids) {
                [$in, $inParams] = Database::in('k', $ids);
                Database::exec("DELETE FROM matricula WHERE turma_id = :t AND usuario_id NOT IN ($in)", ['t' => $p['id']] + $inParams);
            } else {
                Database::exec('DELETE FROM matricula WHERE turma_id = :t', ['t' => $p['id']]);
            }
            foreach ($ids as $alunoId) {
                Database::exec('INSERT IGNORE INTO matricula (usuario_id, turma_id) VALUES (:u, :t)', ['u' => $alunoId, 't' => $p['id']]);
            }
        });
        return Response::ok(['total' => count($ids)]);
    }

    /** GET professores → [{ id, nome }] para os selects. */
    public function professores(): Response
    {
        $rows = Database::all("SELECT id, nome FROM usuario WHERE tipo IN ('professor', 'administrador') AND ativo = 1 ORDER BY nome, id");
        return Response::ok(array_map(static fn ($r) => ['id' => (int) $r['id'], 'nome' => $r['nome']], $rows));
    }

    public static function view(array $r): array
    {
        return [
            'id'           => (int) $r['id'],
            'codigo'       => $r['codigo'],
            'nome'         => $r['nome'],
            'disciplinaId' => (int) $r['disciplina_id'],
            'professorId'  => (int) $r['professor_id'],
            'periodo'      => $r['periodo'],
            'diaSemana'    => (int) $r['dia_semana'],
            'inicio'       => Fmt::hora($r['hora_inicio']),
            'fim'          => Fmt::hora($r['hora_fim']),
            'sala'         => $r['sala'] ?? '',
            'disciplina'   => ['id' => (int) $r['disciplina_id'], 'nome' => $r['disciplina_nome'], 'codigo' => $r['disciplina_codigo']],
            'professor'    => ['id' => (int) $r['professor_id'], 'nome' => $r['professor_nome']],
            'totalAlunos'  => (int) $r['total_alunos'],
        ];
    }

    private function buscar(int $id): array
    {
        return Database::one('SELECT ' . self::SELECT . ' FROM ' . self::FROM . ' WHERE t.id = :id', ['id' => $id]) ?? throw ApiException::notFound('Turma');
    }

    private function params(array $d): array
    {
        return [
            'codigo' => $d['codigo'], 'nome' => $d['nome'], 'disc' => $d['disciplinaId'], 'prof' => $d['professorId'],
            'periodo' => $d['periodo'], 'dia' => $d['diaSemana'], 'ini' => $d['inicio'], 'fim' => $d['fim'], 'sala' => $d['sala'],
        ];
    }

    private function validar(array $body, ?int $id = null): array
    {
        $v = new Validator($body);
        $codigo = $v->text('codigo', 'Informe o código da turma.', 20);
        $codigo = $codigo === null ? null : mb_strtoupper($codigo);
        $nome = $v->text('nome', 'Informe o nome da turma.', 50);
        $disciplinaId = $v->integer('disciplinaId', 'Selecione a disciplina.');
        $professorId = $v->integer('professorId', 'Selecione o professor.');
        $periodo = $v->text('periodo', 'Informe o período letivo.', 10);
        $dia = $v->integer('diaSemana', 'Selecione o dia da semana.', 0, 6, false) ?? 1;
        $inicio = $v->time('inicio', 'Informe o horário de início.');
        $fim = $v->time('fim', 'Informe o horário de término.');
        $sala = $v->text('sala', '', 60, false);

        if ($inicio !== null && $fim !== null && !$v->failed('inicio') && !$v->failed('fim') && $fim <= $inicio) {
            $v->fail('fim', 'O término deve ser posterior ao início.');
        }
        if ($codigo !== null && Database::value('SELECT 1 FROM turma WHERE codigo = :c AND id <> :id LIMIT 1', ['c' => $codigo, 'id' => $id ?? 0])) {
            $v->fail('codigo', 'Já existe uma turma com este código.');
        }
        if ($disciplinaId !== null && !Database::value('SELECT 1 FROM disciplina WHERE id = :id', ['id' => $disciplinaId])) {
            $v->fail('disciplinaId', 'Selecione a disciplina.');
        }
        if ($professorId !== null && !Database::value("SELECT 1 FROM usuario WHERE id = :id AND tipo IN ('professor', 'administrador') AND ativo = 1", ['id' => $professorId])) {
            $v->fail('professorId', 'Selecione o professor.');
        }
        $v->check();

        return [
            'codigo' => $codigo, 'nome' => $nome, 'disciplinaId' => $disciplinaId, 'professorId' => $professorId,
            'periodo' => $periodo, 'diaSemana' => $dia, 'inicio' => $inicio, 'fim' => $fim, 'sala' => $sala,
        ];
    }

    private function duplicidade(\PDOException $e): never
    {
        if (!Database::isDuplicate($e)) {
            throw $e;
        }
        throw ApiException::validation(['codigo' => 'Já existe uma turma com este código.']);
    }
}
