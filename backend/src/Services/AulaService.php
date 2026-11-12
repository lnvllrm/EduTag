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
     * Ciclo automático da aula, pelo relógio:
     *   - agendada → em andamento quando o horário de início chega;
     *   - agendada/em andamento → finalizada quando o horário de término chega
     *     (mais `rfid.minutos_apos_fim`, a tolerância de leitura), lançando "ausente"
     *     para quem não registrou presença.
     * Aulas canceladas não são alteradas. É idempotente e barata (2 UPDATEs), por isso
     * roda a cada requisição da API: não depende de agendador (cron) para o dado estar correto.
     * Retorna quantas aulas foram finalizadas.
     */
    public static function sincronizar(?int $agora = null): int
    {
        $agora ??= time();
        $dia = date('Y-m-d', $agora);
        $hora = date('H:i:s', $agora);
        $fimAula = date('H:i:s', $agora - 60 * (int) Config::get('rfid.minutos_apos_fim', 0));
        $diaFim = date('Y-m-d', $agora - 60 * (int) Config::get('rfid.minutos_apos_fim', 0));

        $vencidas = Database::all(
            "SELECT id, turma_id FROM aula
              WHERE status IN ('agendada', 'em_andamento')
                AND (`data` < :d1 OR (`data` = :d2 AND fim <= :h))",
            ['d1' => $diaFim, 'd2' => $diaFim, 'h' => $fimAula],
        );
        foreach ($vencidas as $a) {
            Database::transaction(function () use ($a): void {
                Database::exec("UPDATE aula SET status = 'finalizada' WHERE id = :id", ['id' => $a['id']]);
                self::gerarAusencias((int) $a['id'], (int) $a['turma_id']);
            });
        }

        Database::exec(
            "UPDATE aula SET status = 'em_andamento'
              WHERE status = 'agendada' AND (`data` < :d1 OR (`data` = :d2 AND inicio <= :h))",
            ['d1' => $dia, 'd2' => $dia, 'h' => $hora],
        );
        return count($vencidas);
    }

    /** Compatível com bin/encerrar-aulas.php (agora apenas chama a sincronização). */
    public static function encerrarVencidas(): int
    {
        return self::sincronizar();
    }
    /** Máximo de aulas geradas por uma repetição semanal (trava de segurança). */
    private const MAX_REPETICOES = 60;

    /**
     * Fim do termo (semestre) da aula: usa o período da turma ("2026.1" / "2026.2");
     * se não for nesse formato, deduz pela data (jan–jun = 1º semestre). Datas em config 'termo'.
     */
    public static function fimDoTermo(string $periodo, string $data): string
    {
        $fim1 = (string) Config::get('termo.fim_1_semestre', '06-30');
        $fim2 = (string) Config::get('termo.fim_2_semestre', '12-15');
        if (preg_match('/^(\d{4})\.([12])$/', $periodo, $m)) {
            return $m[1] . '-' . ($m[2] === '1' ? $fim1 : $fim2);
        }
        $ano = substr($data, 0, 4);
        return $ano . '-' . ((int) substr($data, 5, 2) <= 6 ? $fim1 : $fim2);
    }

    /**
     * Cria as ocorrências semanais seguintes à aula-base (mesmo dia da semana e horário),
     * até o fim do termo, ignorando datas em que a turma já tem aula nesse horário.
     * @return int quantas aulas foram criadas (sem contar a base)
     */
    public static function repetirSemanalmente(int $turmaId, string $data, string $inicio, string $fim, ?string $tema): int
    {
        $periodo = (string) Database::value('SELECT periodo FROM turma WHERE id = :id', ['id' => $turmaId]);
        $limite = self::fimDoTermo($periodo, $data);

        $criadas = 0;
        $d = new \DateTimeImmutable($data);
        for ($i = 0; $i < self::MAX_REPETICOES; $i++) {
            $d = $d->modify('+7 days');
            $dia = $d->format('Y-m-d');
            if ($dia > $limite) {
                break;
            }
            $existe = Database::value(
                'SELECT 1 FROM aula WHERE turma_id = :t AND `data` = :d AND inicio = :i LIMIT 1',
                ['t' => $turmaId, 'd' => $dia, 'i' => $inicio],
            );
            if ($existe) {
                continue;
            }
            Database::insert(
                "INSERT INTO aula (turma_id, `data`, inicio, fim, status, tema) VALUES (:t, :d, :i, :f, 'agendada', :tema)",
                ['t' => $turmaId, 'd' => $dia, 'i' => $inicio, 'f' => $fim, 'tema' => $tema],
            );
            $criadas++;
        }
        return $criadas;
    }}
