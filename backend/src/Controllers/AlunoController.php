<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\ApiException;
use EduTag\Core\Database;
use EduTag\Core\Escopo;
use EduTag\Core\Fmt;
use EduTag\Core\Paginator;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Core\Validator;
use EduTag\Services\Frequencia;
use EduTag\Services\Presencas;

final class AlunoController
{
    private const SELECT = "u.id, u.nome, u.ra AS matricula, u.email, u.curso, u.ativo, u.tag_uid, u.tag_vinculada_em,
        (SELECT COUNT(*) FROM matricula m WHERE m.usuario_id = u.id) AS total_turmas";

    public function listar(Request $req, array $p, array $user): Response
    {
        $where = ["u.tipo = 'aluno'"];
        $params = [];
        if (Escopo::ehProfessor($user)) { // professor: somente alunos matriculados em turmas dele
            $where[] = 'EXISTS (SELECT 1 FROM matricula me JOIN turma te ON te.id = me.turma_id WHERE me.usuario_id = u.id AND te.professor_id = :esc_prof)';
            $params['esc_prof'] = $user['id'];
        }

        if (($status = $req->queryString('status')) !== null) {
            $where[] = 'u.ativo = :f_ativo';
            $params['f_ativo'] = $status === 'ativo' ? 1 : 0;
        }
        $tag = $req->queryString('tag');
        if ($tag === 'com') {
            $where[] = 'u.tag_uid IS NOT NULL';
        } elseif ($tag === 'sem') {
            $where[] = 'u.tag_uid IS NULL';
        }
        if (($turma = $req->queryInt('turmaId')) !== null) {
            $where[] = 'EXISTS (SELECT 1 FROM matricula mt WHERE mt.usuario_id = u.id AND mt.turma_id = :f_turma)';
            $params['f_turma'] = $turma;
        }

        [$rows, $meta] = Paginator::run($req, self::SELECT, 'usuario u', $where, $params, [
            'search'      => ['u.nome', 'u.ra', 'u.email', 'u.tag_uid'],
            'sortable'    => ['nome' => 'u.nome', 'matricula' => 'u.ra', 'status' => 'u.ativo', 'totalTurmas' => 'total_turmas'],
            'defaultSort' => 'nome',
            'tieBreaker'  => 'u.id',
        ]);
        return Response::ok(array_map([self::class, 'view'], $rows), $meta);
    }

    public function mostrar(Request $req, array $p, array $user): Response
    {
        $this->somenteProprio($user, $p['id']);
        return Response::ok(self::view($this->buscar($p['id'])));
    }

    public function criar(Request $req): Response
    {
        $d = $this->validar($req->body());
        $id = Database::transaction(function () use ($d): int {
            try {
                return Database::insert(
                    "INSERT INTO usuario (ra, nome, tipo, senha_hash, tag_uid, ativo, email, curso, tag_vinculada_em, senha_provisoria, criado_em)
                     VALUES (:ra, :nome, 'aluno', :senha, :tag, :ativo, :email, :curso, :vinc, :prov, :criado)",
                    [
                        'ra' => $d['matricula'], 'nome' => $d['nome'],
                        // Senha informada pelo admin (definitiva) ou, na falta dela, a matrícula como senha provisória.
                        'senha' => password_hash($d['senha'] ?? $d['matricula'], PASSWORD_DEFAULT),
                        'prov' => $d['senha'] === null ? 1 : 0,
                        'tag' => $d['tagUid'], 'ativo' => $d['ativo'], 'email' => $d['email'], 'curso' => $d['curso'],
                        'vinc' => $d['tagUid'] ? Fmt::agora() : null, 'criado' => Fmt::agora(),
                    ],
                );
            } catch (\PDOException $e) {
                $this->traduzirDuplicidade($e);
            }
        });
        return Response::created(self::view($this->buscar($id)));
    }

    public function atualizar(Request $req, array $p): Response
    {
        $atual = $this->buscar($p['id']);
        $d = $this->validar($req->body(), $p['id']);

        $trocaSenha = $d['senha'] !== null;
        $vinculadaEm = $d['tagUid'] === null ? null : ($atual['tag_uid'] === $d['tagUid'] ? $atual['tag_vinculada_em'] : Fmt::agora());
        try {
            Database::exec(
                'UPDATE usuario SET ra = :ra, nome = :nome, email = :email, curso = :curso, ativo = :ativo, tag_uid = :tag, tag_vinculada_em = :vinc'
                . ($trocaSenha ? ', senha_hash = :senha, senha_provisoria = 0' : '') . ' WHERE id = :id',
                [
                    'ra' => $d['matricula'], 'nome' => $d['nome'], 'email' => $d['email'], 'curso' => $d['curso'],
                    'ativo' => $d['ativo'], 'tag' => $d['tagUid'], 'vinc' => $vinculadaEm, 'id' => $p['id'],
                ] + ($trocaSenha ? ['senha' => password_hash($d['senha'], PASSWORD_DEFAULT)] : []),
            );
        } catch (\PDOException $e) {
            $this->traduzirDuplicidade($e);
        }
        return Response::ok(self::view($this->buscar($p['id'])));
    }

    public function excluir(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        if ((int) Database::value('SELECT COUNT(*) FROM registro WHERE usuario_id = :id', ['id' => $p['id']]) > 0) {
            throw ApiException::conflict('Não é possível excluir: o aluno possui registros de presença. Marque-o como inativo para preservar o histórico.');
        }
        Database::transaction(function () use ($p): void {
            Database::exec('DELETE FROM matricula WHERE usuario_id = :id', ['id' => $p['id']]);
            Database::exec("DELETE FROM usuario WHERE id = :id AND tipo = 'aluno'", ['id' => $p['id']]);
        });
        return Response::ok(null);
    }

    /** GET alunos/{id}/frequencia → { geral, porTurma[], historico[] } */
    public function frequencia(Request $req, array $p, array $user): Response
    {
        $this->somenteProprio($user, $p['id']);
        $this->buscar($p['id']);

        // O professor enxerga só os registros das aulas das turmas dele.
        [$escW, $escP] = Escopo::turma($user);
        $escSql = $escW ? ' AND ' . implode(' AND ', $escW) : '';
        $params = ['id' => $p['id']] + $escP;

        $geral = Database::one(
            'SELECT ' . Frequencia::sqlContagens() . ' FROM registro r JOIN aula a ON a.id = r.aula_id JOIN turma t ON t.id = a.turma_id WHERE r.usuario_id = :id' . $escSql,
            $params,
        );

        $turmas = Database::all(
            'SELECT t.id, t.codigo, di.id AS disciplina_id, di.nome AS disciplina_nome, di.codigo AS disciplina_codigo, ' . Frequencia::sqlContagens() . '
               FROM registro r
               JOIN aula a ON a.id = r.aula_id
               JOIN turma t ON t.id = a.turma_id
               JOIN disciplina di ON di.id = t.disciplina_id
              WHERE r.usuario_id = :id' . $escSql . '
              GROUP BY t.id, t.codigo, di.id, di.nome, di.codigo
              ORDER BY t.codigo',
            $params,
        );
        $porTurma = array_map(static fn (array $t) => [
            'turma'      => ['id' => (int) $t['id'], 'codigo' => $t['codigo']],
            'disciplina' => ['id' => (int) $t['disciplina_id'], 'nome' => $t['disciplina_nome'], 'codigo' => $t['disciplina_codigo']],
        ] + Frequencia::calcular($t), $turmas);

        $historico = Database::all(
            'SELECT ' . Presencas::SELECT . ' FROM ' . Presencas::FROM . ' WHERE r.usuario_id = :id' . $escSql . ' ORDER BY a.`data` DESC, a.inicio DESC LIMIT 30',
            $params,
        );

        return Response::ok([
            'geral'     => Frequencia::calcular($geral),
            'porTurma'  => $porTurma,
            'historico' => array_map([Presencas::class, 'view'], $historico),
        ]);
    }

    /* ----------------------------------------------------------------- */

    public static function view(array $r): array
    {
        return [
            'id'               => (int) $r['id'],
            'nome'             => $r['nome'],
            'matricula'        => $r['matricula'],
            'email'            => $r['email'],
            'curso'            => $r['curso'],
            'status'           => $r['ativo'] ? 'ativo' : 'inativo',
            'tagUid'           => $r['tag_uid'],
            'tagVinculadaEm'   => Fmt::dataHora($r['tag_vinculada_em']),
            'totalTurmas'      => (int) $r['total_turmas'],
        ];
    }

    private function buscar(int $id): array
    {
        $row = Database::one('SELECT ' . self::SELECT . " FROM usuario u WHERE u.id = :id AND u.tipo = 'aluno'", ['id' => $id]);
        return $row ?? throw ApiException::notFound('Aluno');
    }

    /** O aluno só consulta os próprios dados; o professor, apenas os de alunos das turmas dele. */
    private function somenteProprio(array $user, int $alunoId): void
    {
        if ($user['perfil'] === 'aluno' && $user['id'] !== $alunoId) {
            throw ApiException::forbidden();
        }
        if (Escopo::ehProfessor($user) && !Database::value(
            'SELECT 1 FROM matricula m JOIN turma t ON t.id = m.turma_id WHERE m.usuario_id = :a AND t.professor_id = :p LIMIT 1',
            ['a' => $alunoId, 'p' => $user['id']],
        )) {
            throw ApiException::forbidden();
        }
    }

    /** @return array{nome:string,matricula:string,email:?string,curso:?string,ativo:int,tagUid:?string,senha:?string} */
    private function validar(array $body, ?int $id = null): array
    {
        $v = new Validator($body);
        $nome = $v->text('nome', 'Informe o nome do aluno.', 100);
        $matricula = $v->text('matricula', 'Informe a matrícula.', 20);
        $email = $v->email('email', 'Informe o e-mail.');
        $curso = $v->text('curso', '', 100, false) ?? 'Sistemas de Informação';
        $status = $v->enum('status', ['ativo', 'inativo'], 'Status inválido.', 'ativo');
        $senha = $v->senhaOpcional();

        $tagUid = null;
        $tagRaw = $body['tagUid'] ?? null;
        if (is_string($tagRaw) && trim($tagRaw) !== '') {
            $tagUid = Fmt::uid($tagRaw);
            if ($tagUid === null || !preg_match('/^[0-9A-F]{4,40}$/', $tagUid)) {
                $v->fail('tagUid', 'UID inválido: use apenas caracteres hexadecimais (0-9, A-F).');
            }
        }

        if ($matricula !== null && $this->existe('ra', $matricula, $id)) {
            $v->fail('matricula', 'Já existe um usuário com esta matrícula.');
        }
        if ($email !== null && $this->existe('email', $email, $id)) {
            $v->fail('email', 'Já existe um usuário com este e-mail.');
        }
        if ($tagUid !== null && !$v->failed('tagUid')) {
            $dono = Database::one('SELECT nome FROM usuario WHERE tag_uid = :t AND id <> :id', ['t' => $tagUid, 'id' => $id ?? 0]);
            if ($dono) {
                $v->fail('tagUid', "Esta tag já está vinculada a {$dono['nome']}.");
            }
        }
        $v->check();

        return ['nome' => $nome, 'matricula' => $matricula, 'email' => $email, 'curso' => $curso, 'ativo' => $status === 'ativo' ? 1 : 0, 'tagUid' => $tagUid, 'senha' => $senha];
    }

    private function existe(string $coluna, string $valor, ?int $ignorarId): bool
    {
        // $coluna vem de lista fixa neste arquivo (nunca da requisição).
        return (bool) Database::value("SELECT 1 FROM usuario WHERE $coluna = :v AND id <> :id LIMIT 1", ['v' => $valor, 'id' => $ignorarId ?? 0]);
    }

    /** Condição de corrida entre a checagem e o INSERT/UPDATE: a chave única do banco é a garantia final. */
    private function traduzirDuplicidade(\PDOException $e): never
    {
        if (!Database::isDuplicate($e)) {
            throw $e;
        }
        $msg = (string) $e->getMessage();
        $campo = match (true) {
            str_contains($msg, 'email') => ['email', 'Já existe um usuário com este e-mail.'],
            str_contains($msg, 'tag_uid') => ['tagUid', 'Esta tag já está vinculada a outro usuário.'],
            default => ['matricula', 'Já existe um usuário com esta matrícula.'],
        };
        throw ApiException::validation([$campo[0] => $campo[1]]);
    }
}
