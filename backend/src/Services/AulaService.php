<?php
declare(strict_types=1);

namespace EduTag\Services;

use EduTag\Core\Config;
use EduTag\Core\Database;
use EduTag\Core\Fmt;

/** Regras do ciclo de vida da aula. */
final class AulaService
{
    /**
     * Ao finalizar a aula, quem estava matriculado (e ativo) e não tem registro
     * recebe "ausente" (origem "sistema"). É idempotente.
     */
    public static function gerarAusencias(int $aulaId, int $turmaId): int
    {
        return Database::exec(
            "INSERT INTO registro (aula_id, usuario_id, data_hora_leitura, status, origem)
             SELECT :aula, m.usuario_id, :agora, 'ausente', 'sistema'
               FROM matricula m
               JOIN usuario u ON u.id = m.usuario_id AND u.ativo = 1 AND u.tipo = 'aluno'
              WHERE m.turma_id = :turma
                AND NOT EXISTS (SELECT 1 FROM registro r WHERE r.aula_id = :aula_check AND r.usuario_id = m.usuario_id)",
            ['aula' => $aulaId, 'agora' => Fmt::agora(), 'turma' => $turmaId, 'aula_check' => $aulaId],
        );
    }

    /** Reabrir uma aula desfaz as ausências geradas automaticamente. */
    public static function desfazerAusencias(int $aulaId): void
    {
        Database::exec("DELETE FROM registro WHERE aula_id = :aula AND status = 'ausente' AND origem = 'sistema'", ['aula' => $aulaId]);
    }

    /** Aplica as regras de transição de status (chamado ao criar/editar a aula). */
    public static function aplicarTransicao(int $aulaId, int $turmaId, ?string $anterior, string $novo): void
    {
        if ($novo === 'finalizada' && $anterior !== 'finalizada') {
            self::gerarAusencias($aulaId, $turmaId);
        } elseif ($anterior === 'finalizada' && $novo !== 'finalizada') {
            self::desfazerAusencias($aulaId);
        }
    }

    /**
     * Finaliza aulas já encerradas (agendada/em andamento cujo fim passou há mais de N minutos).
     * Pensado para rodar por agendador (bin/encerrar-aulas.php). Retorna quantas aulas foram finalizadas.
     */
    public static function encerrarVencidas(): int
    {
        $limite = date('Y-m-d H:i:s', time() - 60 * (int) Config::get('aulas.encerrar_apos_min', 30));
        $aulas = Database::all(
            "SELECT id, turma_id FROM aula WHERE status IN ('agendada', 'em_andamento') AND CONCAT(`data`, ' ', fim) <= :limite",
            ['limite' => $limite],
        );
        foreach ($aulas as $a) {
            Database::transaction(function () use ($a): void {
                Database::exec("UPDATE aula SET status = 'finalizada' WHERE id = :id", ['id' => $a['id']]);
                self::gerarAusencias((int) $a['id'], (int) $a['turma_id']);
            });
        }
        return count($aulas);
    }
}
