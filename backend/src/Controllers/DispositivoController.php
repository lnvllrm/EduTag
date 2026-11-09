<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\Config;
use EduTag\Core\Database;
use EduTag\Core\Fmt;
use EduTag\Core\Request;
use EduTag\Core\Response;

/**
 * Leitores e log de leituras (somente consulta). O cadastro de leitores é feito
 * por bin/dispositivo.php, pois envolve gerar o token secreto do equipamento.
 */
final class DispositivoController
{
    public function listar(): Response
    {
        $rows = Database::all(
            'SELECT d.id, d.codigo, d.nome, d.`local`, d.firmware, d.ip, d.ultima_comunicacao, d.ativo,
                    (SELECT COUNT(*) FROM leitura_rfid l WHERE l.dispositivo_id = d.id AND l.lido_em >= :hoje) AS leituras_hoje
               FROM dispositivo d ORDER BY d.nome, d.id',
            ['hoje' => date('Y-m-d 00:00:00')],
        );
        return Response::ok(array_map(static fn (array $r) => [
            'id'                => (int) $r['id'],
            'codigo'            => $r['codigo'],
            'nome'              => $r['nome'],
            'local'             => $r['local'],
            'status'            => self::status($r['ultima_comunicacao'], (bool) $r['ativo']),
            'firmware'          => $r['firmware'],
            'ip'                => $r['ip'],
            'ultimaComunicacao' => Fmt::dataHora($r['ultima_comunicacao']),
            'leiturasHoje'      => (int) $r['leituras_hoje'],
        ], $rows));
    }

    /** GET leituras?dispositivoId=&limit= */
    public function leituras(Request $req): Response
    {
        return Response::ok(self::ultimasLeituras($req->queryInt('dispositivoId'), min($req->queryInt('limit') ?? 20, 100)));
    }

    public static function ultimasLeituras(?int $dispositivoId, int $limite): array
    {
        $limite = max(1, $limite);
        $params = [];
        $where = '';
        if ($dispositivoId !== null) {
            $where = 'WHERE l.dispositivo_id = :disp';
            $params['disp'] = $dispositivoId;
        }
        $rows = Database::all(
            "SELECT l.id, l.uid, l.lido_em, l.resultado, d.id AS disp_id, d.nome AS disp_nome, u.id AS aluno_id, u.nome AS aluno_nome
               FROM leitura_rfid l
               JOIN dispositivo d ON d.id = l.dispositivo_id
               LEFT JOIN usuario u ON u.id = l.usuario_id
               $where ORDER BY l.lido_em DESC, l.id DESC LIMIT $limite",
            $params,
        );
        return array_map(static fn (array $r) => [
            'id'          => (int) $r['id'],
            'uid'         => $r['uid'],
            'lidoEm'      => Fmt::dataHora($r['lido_em']),
            'resultado'   => $r['resultado'],
            'dispositivo' => ['id' => (int) $r['disp_id'], 'nome' => $r['disp_nome']],
            'aluno'       => $r['aluno_id'] ? ['id' => (int) $r['aluno_id'], 'nome' => $r['aluno_nome']] : null,
        ], $rows);
    }

    /** online / instavel / offline — derivado da última comunicação (nunca gravado). */
    public static function status(?string $ultimaComunicacao, bool $ativo = true): string
    {
        if (!$ativo || $ultimaComunicacao === null) {
            return 'offline';
        }
        $segundos = time() - strtotime($ultimaComunicacao);
        if ($segundos <= (int) Config::get('dispositivo.online_seg', 120)) {
            return 'online';
        }
        return $segundos <= (int) Config::get('dispositivo.instavel_seg', 900) ? 'instavel' : 'offline';
    }
}
