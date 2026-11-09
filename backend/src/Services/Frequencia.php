<?php
declare(strict_types=1);

namespace EduTag\Services;

use EduTag\Core\Config;

/**
 * Regras de cálculo da frequência.
 *
 *  - comparecimento = presente + atrasado;
 *  - falta justificada ("justificado") NÃO entra no denominador do percentual
 *    (é abonada), mas é contada em `aulas` e exibida separadamente;
 *  - situação: >= regular → "regular"; >= atencao → "atencao"; abaixo → "risco".
 *
 * Os limites vêm de config.php e precisam ser confirmados com a instituição.
 */
final class Frequencia
{
    /** Trecho SQL que soma cada status; use com a tabela `registro` aliasada como $alias. */
    public static function sqlContagens(string $alias = 'r'): string
    {
        return "COALESCE(SUM($alias.status = 'presente'), 0) AS presentes, "
            . "COALESCE(SUM($alias.status = 'atrasado'), 0) AS atrasados, "
            . "COALESCE(SUM($alias.status = 'ausente'), 0) AS faltas, "
            . "COALESCE(SUM($alias.status = 'justificado'), 0) AS justificados, "
            . "COUNT($alias.id) AS total";
    }

    /** @param array<string,mixed> $c linha com presentes/atrasados/faltas/justificados */
    public static function calcular(array $c): array
    {
        $presentes = (int) $c['presentes'];
        $atrasados = (int) $c['atrasados'];
        $faltas = (int) $c['faltas'];
        $justificados = (int) ($c['justificados'] ?? 0);
        $considerados = $presentes + $atrasados + $faltas;
        $pct = $considerados > 0 ? round((($presentes + $atrasados) / $considerados) * 100, 1) : null;

        return [
            'aulas'        => $presentes + $atrasados + $faltas + $justificados,
            'presencas'    => $presentes,
            'atrasos'      => $atrasados,
            'faltas'       => $faltas,
            'justificadas' => $justificados,
            'pct'          => $pct,
            'situacao'     => $pct === null ? null : self::situacao($pct),
        ];
    }

    public static function situacao(float $pct): string
    {
        if ($pct >= (float) Config::get('frequencia.regular', 85.0)) {
            return 'regular';
        }
        return $pct >= (float) Config::get('frequencia.atencao', 75.0) ? 'atencao' : 'risco';
    }

    /** Resumo de uma chamada: contagens por status. */
    public static function resumo(array $c): array
    {
        return [
            'presentes'    => (int) $c['presentes'],
            'atrasados'    => (int) $c['atrasados'],
            'faltas'       => (int) $c['faltas'],
            'justificados' => (int) $c['justificados'],
            'total'        => (int) $c['total'],
        ];
    }

    /** Soma linhas de contagem (para consolidar por turma / geral). */
    public static function somar(array $linhas): array
    {
        $soma = ['presentes' => 0, 'atrasados' => 0, 'faltas' => 0, 'justificados' => 0, 'total' => 0];
        foreach ($linhas as $l) {
            foreach ($soma as $k => $_) {
                $soma[$k] += (int) $l[$k];
            }
        }
        return $soma;
    }
}
