<?php
declare(strict_types=1);

namespace EduTag\Controllers;

use EduTag\Core\ApiException;
use EduTag\Core\Database;
use EduTag\Core\Fmt;
use EduTag\Core\Request;
use EduTag\Core\Response;
use EduTag\Services\RfidService;

/**
 * Endpoints exclusivos do Arduino. Autenticação por token do dispositivo
 * (Authorization: Bearer <token>), NÃO por sessão de usuário.
 */
final class RfidController
{
    /**
     * POST rfid/leitura  { "uid": "A1:B2:C3:D4" }
     * Responde 200 sempre que a leitura foi processada; `data.resultado` diz o que aconteceu:
     * registrada | duplicada | fora_de_horario | tag_desconhecida.
     */
    public function leitura(Request $req): Response
    {
        $disp = RfidService::autenticar($req->header('authorization'), $req->ip());

        $uid = Fmt::uid(is_string($req->body()['uid'] ?? null) ? $req->body()['uid'] : null);
        if ($uid === null || !preg_match('/^[0-9A-F]{4,40}$/', $uid)) {
            throw ApiException::validation(['uid' => 'Informe o UID da tag em hexadecimal (ex.: A1B2C3D4).']);
        }
        return Response::ok(RfidService::processar($disp, $uid));
    }

    /** POST rfid/heartbeat  { "firmware": "1.2.0" } — o leitor avisa que está vivo (e informa a versão). */
    public function heartbeat(Request $req): Response
    {
        $disp = RfidService::autenticar($req->header('authorization'), $req->ip());
        $firmware = $req->body()['firmware'] ?? null;
        if (is_string($firmware) && $firmware !== '') {
            Database::exec('UPDATE dispositivo SET firmware = :f WHERE id = :id', ['f' => mb_substr($firmware, 0, 20), 'id' => $disp['id']]);
        }
        return Response::ok(['dispositivo' => $disp['codigo'], 'horaServidor' => Fmt::dataHora(Fmt::agora())]);
    }
}
