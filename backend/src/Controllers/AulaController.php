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
use EduTag\Services\AulaService;
use EduTag\Services\Frequencia;

final class AulaController
{
    public const SELECT = 'a.id, a.turma_id, a.`data`, a.inicio, a.fim, a.status, a.tema,
        t.codigo AS turma_codigo, t.nome AS turma_nome, di.id AS disciplina_id, di.nome AS disciplina_nome';

    public const FROM = 'aula a JOIN turma t ON t.id = a.turma_id JOIN disciplina di ON di.id = t.disciplina_id';

    private const STATUS_API = ['agendada', 'em_andamento', 'realizada', 'cancelada'];

    /** GET aulas — professor: resumo da chamada; aluno: apenas as aulas das suas turmas, com a própria presença. */
    public function listar(Request $req, array $p, array $user): Response
    {
        $where = [];
        $params = [];
        if ($user['perfil'] === 'aluno') {
            $where[] = 'EXISTS (SELECT 1 FROM matricula ms WHERE ms.turma_id = a.turma_id AND ms.usuario_id = :f_uid)';
            $params['f_uid'] = $user['id'];
        }
        [$escW, $escP] = Escopo::turma($user);
        $where = array_merge($where, $escW);
        $params += $escP;
        if (($v = $req->queryInt('turmaId')) !== null) {
            $where[] = 'a.turma_id = :f_turma';
            $params['f_turma'] = $v;
        }
        if (($v = $req->queryString('status')) !== null) {
            $where[] = 'a.status = :f_status';
            $params['f_status'] = Fmt::aulaDb($v);
        }
        foreach (['de' => '>=', 'ate' => '<='] as $key => $op) {
            $v = $req->queryString($key);
            if ($v !== null && Validator::isDate($v)) {
                $where[] = "a.`data` $op :f_$key";
                $params["f_$key"] = $v;
            }
        }

        [$rows, $meta] = Paginator::run($req, self::SELECT, self::FROM, $where, $params, [
            'search'       => ['a.tema', 't.codigo', 'di.nome'],
            'sortable'     => ['data' => 'a.`data`', 'turma.codigo' => 't.codigo', 'disciplina.nome' => 'di.nome', 'status' => 'a.status'],
            'defaultSort'  => 'data',
            'defaultOrder' => 'desc',
            'tieBreaker'   => 'a.inicio DESC, a.id DESC',
        ]);
        return Response::ok(self::views($rows, $user), $meta);
    }

    public function criar(Request $req, array $p, array $user): Response
    {
        $d = $this->validar($req->body());
        $repeticoes = 0;
        $id = Database::transaction(function () use ($d, &$repeticoes): int {
            $id = Database::insert(
                'INSERT INTO aula (turma_id, `data`, inicio, fim, status, tema) VALUES (:turma, :data, :ini, :fim, :status, :tema)',
                $this->params($d),
            );
            AulaService::aplicarTransicao($id, $d['turmaId'], null, Fmt::aulaDb($d['status']));
            if ($d['repetir'] === 'semanal') {
                $repeticoes = AulaService::repetirSemanalmente($d['turmaId'], $d['data'], $d['inicio'], $d['fim'], $d['tema']);
            }
            return $id;
        });
        $aula = self::views([$this->buscar($id)], $user)[0];
        $aula['aulasCriadas'] = 1 + $repeticoes; // com repetição semanal: a aula informada + as seguintes até o fim do termo
        return Response::created($aula);
    }

    public function atualizar(Request $req, array $p, array $user): Response
    {
        $atual = $this->buscar($p['id']);
        $d = $this->validar($req->body());
        Database::transaction(function () use ($p, $d, $atual): void {
            if ((int) $atual['turma_id'] !== $d['turmaId'] && Database::value('SELECT 1 FROM registro WHERE aula_id = :id LIMIT 1', ['id' => $p['id']])) {
                throw ApiException::validation(['turmaId' => 'Não é possível trocar a turma de uma aula que já possui registros de presença.']);
            }
            Database::exec(
                'UPDATE aula SET turma_id = :turma, `data` = :data, inicio = :ini, fim = :fim, status = :status, tema = :tema WHERE id = :id',
                $this->params($d) + ['id' => $p['id']],
            );
            AulaService::aplicarTransicao($p['id'], $d['turmaId'], $atual['status'], Fmt::aulaDb($d['status']));
        });
        return Response::ok(self::views([$this->buscar($p['id'])], $user)[0]);
    }

    public function excluir(Request $req, array $p): Response
    {
        $this->buscar($p['id']);
        // Presenças reais (RFID/manual) são histórico: a aula deve ser cancelada, não apagada.
        if (Database::value("SELECT 1 FROM registro WHERE aula_id = :id AND NOT (status = 'ausente' AND origem = 'sistema') LIMIT 1", ['id' => $p['id']])) {
            throw ApiException::conflict('Não é possível excluir: a aula possui presenças registradas. Altere o status para "Cancelada" para preservar o histórico.');
        }
        Database::transaction(function () use ($p): void {
            Database::exec('DELETE FROM registro WHERE aula_id = :id', ['id' => $p['id']]);
            Database::exec('DELETE FROM aula WHERE id = :id', ['id' => $p['id']]);
        });
        return Response::ok(null);
    }

    /**
     * Linhas de aula → objetos da API. Professor recebe `resumo`; aluno recebe `presenca` (a dele).
     * Carrega as contagens em UMA consulta para a página inteira (evita N+1).
     * @param list<array> $rows
     * @return list<array>
     */
    public static function views(array $rows, array $user): array
    {
        if (!$rows) {
            return [];
        }
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        [$in, $inParams] = Database::in('i', $ids);

        $extra = [];
        if ($user['perfil'] === 'aluno') {
            $regs = Database::all(
                "SELECT r.aula_id, r.status, r.data_hora_leitura, r.dispositivo_id, d.nome AS dispositivo_nome
                   FROM registro r LEFT JOIN dispositivo d ON d.id = r.dispositivo_id
                  WHERE r.usuario_id = :uid AND r.aula_id IN ($in)",
                ['uid' => $user['id']] + $inParams,
            );
            foreach ($regs as $r) {
                $extra[(int) $r['aula_id']] = ['presenca' => [
                    'status'       => Fmt::presenca($r['status']),
                    'registradoEm' => Fmt::dataHora($r['data_hora_leitura']),
                    'dispositivo'  => $r['dispositivo_id'] ? ['id' => (int) $r['dispositivo_id'], 'nome' => $r['dispositivo_nome']] : null,
                ]];
            }
        } else {
            $cont = Database::all('SELECT r.aula_id, ' . Frequencia::sqlContagens() . " FROM registro r WHERE r.aula_id IN ($in) GROUP BY r.aula_id", $inParams);
            foreach ($cont as $c) {
                $extra[(int) $c['aula_id']] = ['resumo' => Frequencia::resumo($c)];
            }
        }

        $semRegistro = $user['perfil'] === 'aluno'
            ? ['presenca' => null]
            : ['resumo' => ['presentes' => 0, 'faltas' => 0, 'justificados' => 0, 'total' => 0]];

        return array_map(static fn (array $r) => self::base($r) + ($extra[(int) $r['id']] ?? $semRegistro), $rows);
    }

    public static function base(array $r): array
    {
        return [
            'id'         => (int) $r['id'],
            'turmaId'    => (int) $r['turma_id'],
            'data'       => $r['data'],
            'inicio'     => Fmt::hora($r['inicio']),
            'fim'        => Fmt::hora($r['fim']),
            'tema'       => $r['tema'] ?? '',
            'status'     => Fmt::aula($r['status']),
            'turma'      => ['id' => (int) $r['turma_id'], 'codigo' => $r['turma_codigo'], 'nome' => $r['turma_nome']],
            'disciplina' => ['id' => (int) $r['disciplina_id'], 'nome' => $r['disciplina_nome']],
        ];
    }

    private function buscar(int $id): array
    {
        return Database::one('SELECT ' . self::SELECT . ' FROM ' . self::FROM . ' WHERE a.id = :id', ['id' => $id]) ?? throw ApiException::notFound('Aula');
    }

    private function params(array $d): array
    {
        return ['turma' => $d['turmaId'], 'data' => $d['data'], 'ini' => $d['inicio'], 'fim' => $d['fim'], 'status' => Fmt::aulaDb($d['status']), 'tema' => $d['tema']];
    }

    private function validar(array $body): array
    {
        $v = new Validator($body);
        $turmaId = $v->integer('turmaId', 'Selecione a turma.');
        $data = $v->date('data', 'Informe a data da aula.');
        $inicio = $v->time('inicio', 'Informe o horário de início.');
        $fim = $v->time('fim', 'Informe o horário de término.');
        $tema = $v->text('tema', '', 150, false);
        $status = $v->enum('status', self::STATUS_API, 'Status inválido.', 'agendada');
        $repetir = $v->enum('repetir', ['nao', 'semanal'], 'Opção de repetição inválida.', 'nao');

        if ($inicio !== null && $fim !== null && !$v->failed('inicio') && !$v->failed('fim') && $fim <= $inicio) {
            $v->fail('fim', 'O término deve ser posterior ao início.');
        }
        if ($turmaId !== null && !Database::value('SELECT 1 FROM turma WHERE id = :id', ['id' => $turmaId])) {
            $v->fail('turmaId', 'Selecione a turma.');
        }
        $v->check();
        return ['turmaId' => $turmaId, 'data' => $data, 'inicio' => $inicio, 'fim' => $fim, 'tema' => $tema, 'status' => $status, 'repetir' => $repetir];
    }
}
