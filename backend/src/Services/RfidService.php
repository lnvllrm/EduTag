<?php
declare(strict_types=1);

namespace EduTag\Services;

use EduTag\Core\ApiException;
use EduTag\Core\Config;
use EduTag\Core\Database;
use EduTag\Core\Fmt;

/**
 * Processa uma leitura de tag enviada por um leitor (Arduino).
 *
 * Regras (limiares em config.php → 'rfid'):
 *  1. a tag precisa pertencer a um ALUNO ATIVO, senão → tag_desconhecida;
 *  2. procura, entre as turmas do aluno, uma aula de HOJE (agendada ou em andamento)
 *     cuja janela [início − N min, fim + M min] contenha o momento da leitura,
 *     senão → fora_de_horario;
 *  3. se o aluno já tem registro nessa aula → duplicada (nada muda);
 *  4. caso contrário grava o registro: "atrasado" se passou da tolerância após
 *     o início, "presente" nos demais casos, e a aula passa a "em andamento".
 *
 * Toda leitura é gravada em leitura_rfid, qualquer que seja o resultado.
 */
final class RfidService
{
    public static function processar(array $dispositivo, string $uid, ?int $agora = null): array
    {
        $agora ??= time();
        $now = date('Y-m-d H:i:s', $agora);

        $aluno = Database::one(
            "SELECT id, nome FROM usuario WHERE tag_uid = :uid AND tipo = 'aluno' AND ativo = 1",
            ['uid' => $uid],
        );
        if ($aluno === null) {
            self::logar($dispositivo, $uid, $now, 'tag_desconhecida');
            return self::resposta('tag_desconhecida', 'Tag não vinculada a um aluno ativo.');
        }

        $aula = self::aulaDaLeitura((int) $aluno['id'], $agora);
        if ($aula === null) {
            self::logar($dispositivo, $uid, $now, 'fora_de_horario', (int) $aluno['id']);
            return self::resposta('fora_de_horario', 'Nenhuma aula em andamento para este aluno agora.', $aluno);
        }

        $existente = Database::one(
            'SELECT status FROM registro WHERE aula_id = :aula AND usuario_id = :aluno',
            ['aula' => $aula['id'], 'aluno' => $aluno['id']],
        );
        if ($existente !== null) {
            self::logar($dispositivo, $uid, $now, 'duplicada', (int) $aluno['id'], (int) $aula['id']);
            return self::resposta('duplicada', 'Presença já registrada nesta aula.', $aluno, Fmt::presenca($existente['status']));
        }

        $inicio = strtotime($aula['data'] . ' ' . $aula['inicio']);
        $status = $agora > $inicio + 60 * (int) Config::get('rfid.tolerancia_atraso_min', 15) ? 'atrasado' : 'presente';

        try {
            $registroId = Database::transaction(function () use ($aula, $aluno, $now, $status, $dispositivo): int {
                $id = Database::insert(
                    "INSERT INTO registro (aula_id, usuario_id, data_hora_leitura, status, dispositivo_id, origem)
                     VALUES (:aula, :aluno, :quando, :status, :disp, 'rfid')",
                    ['aula' => $aula['id'], 'aluno' => $aluno['id'], 'quando' => $now, 'status' => $status, 'disp' => $dispositivo['id']],
                );
                if ($aula['status'] === 'agendada') {
                    Database::exec("UPDATE aula SET status = 'em_andamento' WHERE id = :id", ['id' => $aula['id']]);
                }
                return $id;
            });
        } catch (\PDOException $e) {
            if (Database::isDuplicate($e)) { // leituras simultâneas da mesma tag
                self::logar($dispositivo, $uid, $now, 'duplicada', (int) $aluno['id'], (int) $aula['id']);
                return self::resposta('duplicada', 'Presença já registrada nesta aula.', $aluno);
            }
            throw $e;
        }

        self::logar($dispositivo, $uid, $now, 'registrada', (int) $aluno['id'], (int) $aula['id'], $registroId);
        return self::resposta('registrada', $status === 'atrasado' ? 'Presença registrada (atraso).' : 'Presença registrada.', $aluno, $status);
    }

    /** Aula de hoje, das turmas do aluno, cuja janela contém o instante da leitura (a mais próxima do início). */
    private static function aulaDaLeitura(int $alunoId, int $agora): ?array
    {
        $antes = 60 * (int) Config::get('rfid.minutos_antes_inicio', 15);
        $depois = 60 * (int) Config::get('rfid.minutos_apos_fim', 0);

        $candidatas = Database::all(
            "SELECT a.id, a.`data`, a.inicio, a.fim, a.status
               FROM aula a
               JOIN matricula m ON m.turma_id = a.turma_id AND m.usuario_id = :aluno
              WHERE a.`data` = :hoje AND a.status IN ('agendada', 'em_andamento')",
            ['aluno' => $alunoId, 'hoje' => date('Y-m-d', $agora)],
        );

        $melhor = null;
        $melhorDist = PHP_INT_MAX;
        foreach ($candidatas as $a) {
            $ini = strtotime($a['data'] . ' ' . $a['inicio']);
            $fim = strtotime($a['data'] . ' ' . $a['fim']);
            if ($agora >= $ini - $antes && $agora <= $fim + $depois) {
                $dist = abs($agora - $ini);
                if ($dist < $melhorDist) {
                    $melhor = $a;
                    $melhorDist = $dist;
                }
            }
        }
        return $melhor;
    }

    private static function logar(array $disp, string $uid, string $quando, string $resultado, ?int $alunoId = null, ?int $aulaId = null, ?int $registroId = null): void
    {
        Database::insert(
            'INSERT INTO leitura_rfid (dispositivo_id, uid, lido_em, resultado, usuario_id, aula_id, registro_id)
             VALUES (:disp, :uid, :quando, :res, :aluno, :aula, :reg)',
            ['disp' => $disp['id'], 'uid' => $uid, 'quando' => $quando, 'res' => $resultado, 'aluno' => $alunoId, 'aula' => $aulaId, 'reg' => $registroId],
        );
    }

    private static function resposta(string $resultado, string $mensagem, ?array $aluno = null, ?string $status = null): array
    {
        return [
            'resultado' => $resultado,
            'mensagem'  => $mensagem,
            'aluno'     => $aluno ? ['id' => (int) $aluno['id'], 'nome' => $aluno['nome']] : null,
            'status'    => $status,
        ];
    }

    /** Autentica o leitor pelo token (Authorization: Bearer …) e atualiza a última comunicação. */
    public static function autenticar(?string $authorization, string $ip): array
    {
        if ($authorization === null || !preg_match('/^Bearer\s+(\S{16,128})$/i', trim($authorization), $m)) {
            throw new ApiException(401, 'invalid_device_token', 'Token do dispositivo ausente ou inválido.');
        }
        $disp = Database::one(
            'SELECT id, codigo, nome FROM dispositivo WHERE token_hash = :h AND ativo = 1',
            ['h' => hash('sha256', $m[1])],
        );
        if ($disp === null) {
            throw new ApiException(401, 'invalid_device_token', 'Token do dispositivo ausente ou inválido.');
        }
        Database::exec('UPDATE dispositivo SET ultima_comunicacao = :agora, ip = :ip WHERE id = :id', ['agora' => Fmt::agora(), 'ip' => $ip, 'id' => $disp['id']]);
        return $disp;
    }
}
