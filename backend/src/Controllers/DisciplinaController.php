<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\ApiException;
use EduTag\Core\Database;
use EduTag\Core\Paginator;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Core\Validator;

final class DisciplinaController
{
    private const SELECT = 'd.id, d.nome, d.codigo, d.carga_horaria, d.descricao,
        (SELECT COUNT(*) FROM turma t WHERE t.disciplina_id = d.id) AS total_turmas';

    public function listar(Request $req): Response
    {
        [$rows, $meta] = Paginator::run($req, self::SELECT, 'disciplina d', [], [], [
            'search'      => ['d.nome', 'd.codigo'],
            'sortable'    => ['nome' => 'd.nome', 'codigo' => 'd.codigo', 'cargaHoraria' => 'd.carga_horaria', 'totalTurmas' => 'total_turmas'],
            'defaultSort' => 'nome',
            'tieBreaker'  => 'd.id',
        ]);
        return Response::ok(array_map([self::class, 'view'], $rows), $meta);
    }

    public function criar(Request $req): Response
    {
        $d = $this->validar($req->body());
        try {
            $id = Database::insert(
                'INSERT INTO disciplina (nome, codigo, carga_horaria, descricao) VALUES (:nome, :codigo, :ch, :desc)',
                ['nome' => $d['nome'], 'codigo' => $d['codigo'], 'ch' => $d['cargaHoraria'], 'desc' => $d['descricao']],
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
                'UPDATE disciplina SET nome = :nome, codigo = :codigo, carga_horaria = :ch, descricao = :desc WHERE id = :id',
                ['nome' => $d['nome'], 'codigo' => $d['codigo'], 'ch' => $d['cargaHoraria'], 'desc' => $d['descricao'], 'id' => $p['id']],
            );
        } catch (\PDOException $e) {
            $this->duplicidade($e);
        }
        return Response::ok(self::view($this->buscar($p['id'])));
    }

    public function excluir(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        if (Database::value('SELECT 1 FROM turma WHERE disciplina_id = :id LIMIT 1', ['id' => $p['id']])) {
            throw ApiException::conflict('Não é possível excluir: existem turmas vinculadas a esta disciplina.');
        }
        Database::exec('DELETE FROM disciplina WHERE id = :id', ['id' => $p['id']]);
        return Response::ok(null);
    }

    public static function view(array $r): array
    {
        return [
            'id'           => (int) $r['id'],
            'nome'         => $r['nome'],
            'codigo'       => $r['codigo'],
            'cargaHoraria' => (int) $r['carga_horaria'],
            'descricao'    => $r['descricao'] ?? '',
            'totalTurmas'  => (int) $r['total_turmas'],
        ];
    }

    private function buscar(int $id): array
    {
        return Database::one('SELECT ' . self::SELECT . ' FROM disciplina d WHERE d.id = :id', ['id' => $id]) ?? throw ApiException::notFound('Disciplina');
    }

    private function validar(array $body, ?int $id = null): array
    {
        $v = new Validator($body);
        $nome = $v->text('nome', 'Informe o nome da disciplina.', 100);
        $codigo = $v->text('codigo', 'Informe o código.', 20);
        $codigo = $codigo === null ? null : mb_strtoupper($codigo);
        $ch = $v->integer('cargaHoraria', 'Informe a carga horária em horas.', 1, 2000);
        $descricao = $v->text('descricao', '', 2000, false);

        if ($codigo !== null && Database::value('SELECT 1 FROM disciplina WHERE codigo = :c AND id <> :id LIMIT 1', ['c' => $codigo, 'id' => $id ?? 0])) {
            $v->fail('codigo', 'Já existe uma disciplina com este código.');
        }
        $v->check();
        return ['nome' => $nome, 'codigo' => $codigo, 'cargaHoraria' => $ch, 'descricao' => $descricao];
    }

    private function duplicidade(\PDOException $e): never
    {
        if (!Database::isDuplicate($e)) {
            throw $e;
        }
        throw ApiException::validation(['codigo' => 'Já existe uma disciplina com este código.']);
    }
}
