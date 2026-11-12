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

/**
 * Professores (usuario.tipo = 'professor'). A listagem também traz os administradores,
 * pois eles podem ser responsáveis por turmas (alimenta o select de turmas), mas só
 * professores podem ser criados, editados ou excluídos por aqui.
 */
final class ProfessorController
{
    private const SELECT = "u.id, u.nome, u.ra AS matricula, u.email, u.tipo, u.ativo,
        (SELECT COUNT(*) FROM turma t WHERE t.professor_id = u.id) AS total_turmas";

    public function listar(Request $req): Response
    {
        $where = ["u.tipo IN ('professor', 'administrador')"];
        $params = [];
        if (($status = $req->queryString('status')) !== null) {
            $where[] = 'u.ativo = :f_ativo';
            $params['f_ativo'] = $status === 'ativo' ? 1 : 0;
        }
        [$rows, $meta] = Paginator::run($req, self::SELECT, 'usuario u', $where, $params, [
            'search'      => ['u.nome', 'u.ra', 'u.email'],
            'sortable'    => ['nome' => 'u.nome', 'matricula' => 'u.ra', 'status' => 'u.ativo', 'totalTurmas' => 'total_turmas'],
            'defaultSort' => 'nome',
            'tieBreaker'  => 'u.id',
        ]);
        return Response::ok(array_map([self::class, 'view'], $rows), $meta);
    }

    public function criar(Request $req): Response
    {
        $d = $this->validar($req->body());
        try {
            $id = Database::insert(
                "INSERT INTO usuario (ra, nome, tipo, senha_hash, ativo, email, senha_provisoria, criado_em)
                 VALUES (:ra, :nome, 'professor', :senha, :ativo, :email, :prov, :criado)",
                [
                    'ra' => $d['matricula'], 'nome' => $d['nome'],
                    // Senha informada pelo admin (definitiva) ou, na falta dela, a matrícula como senha provisória.
                    'senha' => password_hash($d['senha'] ?? $d['matricula'], PASSWORD_DEFAULT),
                    'prov' => $d['senha'] === null ? 1 : 0,
                    'ativo' => $d['ativo'], 'email' => $d['email'], 'criado' => Fmt::agora(),
                ],
            );
        } catch (\PDOException $e) {
            $this->traduzirDuplicidade($e);
        }
        return Response::created(self::view($this->buscar($id)));
    }

    public function atualizar(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        $d = $this->validar($req->body(), $p['id']);
        if (!$d['ativo'] && $this->temTurmas($p['id'])) {
            // Inativar quem ainda é responsável por turmas esconderia a turma do select e quebraria edições.
            throw ApiException::validation(['status' => 'Este professor ainda é responsável por turmas. Troque o professor delas antes de inativá-lo.']);
        }
        try {
            Database::exec(
                'UPDATE usuario SET ra = :ra, nome = :nome, email = :email, ativo = :ativo'
                . ($d['senha'] !== null ? ', senha_hash = :senha, senha_provisoria = 0' : '') . ' WHERE id = :id',
                ['ra' => $d['matricula'], 'nome' => $d['nome'], 'email' => $d['email'], 'ativo' => $d['ativo'], 'id' => $p['id']]
                + ($d['senha'] !== null ? ['senha' => password_hash($d['senha'], PASSWORD_DEFAULT)] : []),
            );
        } catch (\PDOException $e) {
            $this->traduzirDuplicidade($e);
        }
        return Response::ok(self::view($this->buscar($p['id'])));
    }

    public function excluir(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        if ($this->temTurmas($p['id'])) {
            throw ApiException::conflict('Não é possível excluir: o professor é responsável por turmas. Troque o professor delas antes.');
        }
        Database::exec("DELETE FROM usuario WHERE id = :id AND tipo = 'professor'", ['id' => $p['id']]);
        return Response::ok(null);
    }

    public static function view(array $r): array
    {
        return [
            'id'          => (int) $r['id'],
            'nome'        => $r['nome'],
            'matricula'   => $r['matricula'],
            'email'       => $r['email'],
            'tipo'        => $r['tipo'],
            'status'      => $r['ativo'] ? 'ativo' : 'inativo',
            'totalTurmas' => (int) $r['total_turmas'],
        ];
    }

    /** Somente professores são gerenciáveis aqui (administradores não). */
    private function buscar(int $id): array
    {
        return Database::one('SELECT ' . self::SELECT . " FROM usuario u WHERE u.id = :id AND u.tipo = 'professor'", ['id' => $id])
            ?? throw ApiException::notFound('Professor');
    }

    private function temTurmas(int $id): bool
    {
        return (bool) Database::value('SELECT 1 FROM turma WHERE professor_id = :id LIMIT 1', ['id' => $id]);
    }

    /** @return array{nome:string,matricula:string,email:string,ativo:int,senha:?string} */
    private function validar(array $body, ?int $id = null): array
    {
        $v = new Validator($body);
        $nome = $v->text('nome', 'Informe o nome do professor.', 100);
        $matricula = $v->text('matricula', 'Informe a matrícula.', 20);
        $email = $v->email('email', 'Informe o e-mail.');
        $status = $v->enum('status', ['ativo', 'inativo'], 'Status inválido.', 'ativo');
        $senha = $v->senhaOpcional();

        if ($matricula !== null && $this->existe('ra', $matricula, $id)) {
            $v->fail('matricula', 'Já existe um usuário com esta matrícula.');
        }
        if ($email !== null && $this->existe('email', $email, $id)) {
            $v->fail('email', 'Já existe um usuário com este e-mail.');
        }
        $v->check();
        return ['nome' => $nome, 'matricula' => $matricula, 'email' => $email, 'ativo' => $status === 'ativo' ? 1 : 0, 'senha' => $senha];
    }

    private function existe(string $coluna, string $valor, ?int $ignorarId): bool
    {
        // $coluna vem de lista fixa neste arquivo (nunca da requisição).
        return (bool) Database::value("SELECT 1 FROM usuario WHERE $coluna = :v AND id <> :id LIMIT 1", ['v' => $valor, 'id' => $ignorarId ?? 0]);
    }

    private function traduzirDuplicidade(\PDOException $e): never
    {
        if (!Database::isDuplicate($e)) {
            throw $e;
        }
        $campo = str_contains((string) $e->getMessage(), 'email')
            ? ['email', 'Já existe um usuário com este e-mail.']
            : ['matricula', 'Já existe um usuário com esta matrícula.'];
        throw ApiException::validation([$campo[0] => $campo[1]]);
    }
}
