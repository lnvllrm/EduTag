<?php
declare(strict_types=1);

namespace EduTag\Core;

/**
 * Escopo de visibilidade por perfil:
 *   administrador → enxerga tudo;
 *   professor     → apenas as turmas em que é o responsável (turma.professor_id) e o que delas decorre;
 *   aluno         → tratado em cada controller (somente os próprios dados).
 */
final class Escopo
{
    public static function ehProfessor(array $user): bool
    {
        return $user['perfil'] === 'professor';
    }

    /**
     * Condição limitando a turma (alias SQL $alias) ao professor logado.
     * @return array{0:list<string>,1:array}  [where, params] — vazios para os demais perfis
     */
    public static function turma(array $user, string $alias = 't'): array
    {
        return self::ehProfessor($user) ? [["$alias.professor_id = :esc_prof"], ['esc_prof' => $user['id']]] : [[], []];
    }

    /** O professor só acessa turmas dele; os demais perfis passam (o aluno é filtrado pelo controller). */
    public static function exigirTurma(array $user, int $turmaId): void
    {
        if (self::ehProfessor($user) && !Database::value('SELECT 1 FROM turma WHERE id = :t AND professor_id = :p', ['t' => $turmaId, 'p' => $user['id']])) {
            throw ApiException::forbidden();
        }
    }
}
