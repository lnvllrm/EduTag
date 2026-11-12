<?php
declare(strict_types=1);

namespace EduTag\Services;

use EduTag\Core\Database;

/**
 * Dados de demonstração (os mesmos personagens do mock do front-end), com datas
 * relativas a "hoje". Usado por bin/instalar.php --demo. NÃO use em produção:
 * todas as contas recebem a senha DEMO_SENHA.
 */
final class DemoData
{
    public const DEMO_SENHA = 'edutag123';

    private const NOMES = [
        'Ana Beatriz Souza', 'Bruno Henrique Lima', 'Camila Ferreira Rocha', 'Daniel Oliveira Costa',
        'Eduarda Martins Pires', 'Felipe Augusto Ramos', 'Gabriela Nunes Teixeira', 'Heitor Santos Barbosa',
        'Isabela Cardoso Melo', 'João Pedro Almeida', 'Karen Lopes Vieira', 'Lucas Gabriel Moreira',
        'Mariana Dias Carvalho', 'Nicolas Pereira Araújo', 'Olívia Ribeiro Castro', 'Pedro Henrique Gomes',
        'Quésia Monteiro Freitas', 'Rafael Duarte Campos', 'Sofia Andrade Lacerda', 'Thiago Batista Neves',
        'Ursula Machado Pinto', 'Vinícius Correia Leite', 'Wesley Antunes Braga', 'Yasmin Cavalcante Reis',
        'Zaira Fonseca Borges', 'Arthur Mendes Salles', 'Beatriz Ayres Quintana', 'Caio Vasconcelos Lins',
    ];

    private const DISCIPLINAS = [
        ['ROB101', 'Robótica', 60, 'Fundamentos de robótica, sensores, atuadores e prototipagem com Arduino.'],
        ['BDD201', 'Banco de Dados', 80, 'Modelagem relacional, SQL e administração de bancos MySQL.'],
        ['PWB301', 'Programação Web', 80, 'HTML, CSS, JavaScript e desenvolvimento de aplicações web com PHP.'],
        ['ESW202', 'Engenharia de Software', 60, 'Processos, requisitos, arquitetura e qualidade de software.'],
        ['EDA102', 'Estruturas de Dados', 80, 'Listas, pilhas, filas, árvores e análise de complexidade.'],
    ];

    // código, nome, disciplina (índice), professor (índice), dia da semana, início, fim, sala
    private const TURMAS = [
        ['SI5N-ROB', 'SI 5º Período — Noturno', 0, 1, 1, '19:00', '20:40', 'Lab. de Robótica'],
        ['SI5N-BDD', 'SI 5º Período — Noturno', 1, 2, 2, '19:00', '20:40', 'Sala 201'],
        ['SI5N-PWB', 'SI 5º Período — Noturno', 2, 1, 3, '19:00', '20:40', 'Lab. de Informática 1'],
        ['SI3N-ESW', 'SI 3º Período — Noturno', 3, 3, 4, '20:50', '22:30', 'Sala 305'],
        ['SI3N-EDA', 'SI 3º Período — Noturno', 4, 2, 5, '19:00', '20:40', 'Sala 202'],
    ];

    private const PROFESSORES = [
        ['P0001', 'Helena Prado', 'helena.prado@edutag.edu.br'],
        ['P0002', 'Carla Mendes', 'carla.mendes@edutag.edu.br'],
        ['P0003', 'Ricardo Alves', 'ricardo.alves@edutag.edu.br'],
        ['P0004', 'Marina Duarte', 'marina.duarte@edutag.edu.br'],
    ];

    private const TEMAS = [
        'Apresentação da disciplina', 'Conceitos fundamentais', 'Estudo de caso', 'Prática em laboratório',
        'Revisão e exercícios', 'Projeto em equipe', 'Avaliação parcial', 'Seminário', 'Tópicos avançados',
        'Oficina prática', 'Correção de atividades', 'Orientação de projetos',
    ];

    /** @return array{alunos:int,aulas:int,registros:int,tokenLeitor:string} */
    public static function gerar(): array
    {
        mt_srand(20262);
        $hash = password_hash(self::DEMO_SENHA, PASSWORD_DEFAULT);
        $hoje = new \DateTimeImmutable('today');
        $agora = date('Y-m-d H:i:s');

        return Database::transaction(function () use ($hash, $hoje, $agora): array {
            // Administrador + professores
            Database::insert(
                "INSERT INTO usuario (ra, nome, tipo, senha_hash, ativo, email, criado_em) VALUES ('ADM01', 'Administração EduTag', 'administrador', :h, 1, 'admin@edutag.edu.br', :t)",
                ['h' => $hash, 't' => $agora],
            );
            $profIds = [];
            foreach (self::PROFESSORES as [$ra, $nome, $email]) {
                $profIds[] = Database::insert(
                    "INSERT INTO usuario (ra, nome, tipo, senha_hash, ativo, email, criado_em) VALUES (:ra, :nome, 'professor', :h, 1, :email, :t)",
                    ['ra' => $ra, 'nome' => $nome, 'h' => $hash, 'email' => $email, 't' => $agora],
                );
            }

            $discIds = [];
            foreach (self::DISCIPLINAS as [$codigo, $nome, $ch, $desc]) {
                $discIds[] = Database::insert(
                    'INSERT INTO disciplina (nome, codigo, carga_horaria, descricao) VALUES (:n, :c, :ch, :d)',
                    ['n' => $nome, 'c' => $codigo, 'ch' => $ch, 'd' => $desc],
                );
            }

            $turmas = [];
            foreach (self::TURMAS as [$codigo, $nome, $disc, $prof, $dia, $ini, $fim, $sala]) {
                $id = Database::insert(
                    'INSERT INTO turma (codigo, nome, disciplina_id, professor_id, periodo, dia_semana, hora_inicio, hora_fim, sala)
                     VALUES (:c, :n, :d, :p, :per, :dia, :i, :f, :s)',
                    ['c' => $codigo, 'n' => $nome, 'd' => $discIds[$disc], 'p' => $profIds[$prof], 'per' => '2026.2', 'dia' => $dia, 'i' => $ini, 'f' => $fim, 's' => $sala],
                );
                $turmas[] = ['id' => $id, 'dia' => $dia, 'ini' => $ini, 'fim' => $fim];
            }

            // Alunos (4 sem tag, 1 inativo, e três com frequência baixa para exercitar os alertas)
            $usados = [];
            $alunos = [];
            foreach (self::NOMES as $i => $nome) {
                do {
                    $uid = '';
                    for ($b = 0; $b < 4; $b++) {
                        $uid .= strtoupper(str_pad(dechex(mt_rand(0, 255)), 2, '0', STR_PAD_LEFT));
                    }
                } while (isset($usados[$uid]));
                $usados[$uid] = true;
                $semTag = in_array($i, [5, 13, 21, 26], true);
                $taxa = match ($i) { 7 => 0.52, 16 => 0.60, 22 => 0.68, default => 0.82 + mt_rand() / mt_getrandmax() * 0.17 };
                $id = Database::insert(
                    "INSERT INTO usuario (ra, nome, tipo, senha_hash, tag_uid, ativo, email, curso, tag_vinculada_em, criado_em)
                     VALUES (:ra, :nome, 'aluno', :h, :tag, :ativo, :email, 'Sistemas de Informação', :vinc, :t)",
                    [
                        'ra' => '2024' . str_pad((string) (10200 + $i * 7), 5, '0', STR_PAD_LEFT), 'nome' => $nome, 'h' => $hash,
                        'tag' => $semTag ? null : $uid, 'ativo' => $i === 19 ? 0 : 1, 'email' => self::email($nome),
                        'vinc' => $semTag ? null : $hoje->modify('-' . mt_rand(40, 110) . ' days')->format('Y-m-d 09:00:00'), 't' => $agora,
                    ],
                );
                $alunos[] = ['id' => $id, 'taxa' => $taxa, 'ativo' => $i !== 19];
            }

            // Matrículas: cada aluno em 2 ou 3 turmas
            $matriculas = array_fill_keys(array_column($turmas, 'id'), []);
            foreach ($alunos as $a) {
                $ids = array_column($turmas, 'id');
                shuffle($ids);
                foreach (array_slice($ids, 0, mt_rand(2, 3)) as $turmaId) {
                    Database::insert('INSERT INTO matricula (usuario_id, turma_id) VALUES (:u, :t)', ['u' => $a['id'], 't' => $turmaId]);
                    $matriculas[$turmaId][] = $a;
                }
            }

            // Dispositivos (um por turma). Token fixo de demonstração, só para testes locais.
            $token = 'demo-' . str_repeat('0123456789abcdef', 3);
            $dispIds = [];
            foreach (self::TURMAS as $i => $t) {
                $dispIds[] = Database::insert(
                    'INSERT INTO dispositivo (codigo, nome, `local`, token_hash, firmware, ativo) VALUES (:c, :n, :l, :h, :f, 1)',
                    ['c' => sprintf('ET-RDR-%02d', $i + 1), 'n' => 'Leitor — ' . $t[7], 'l' => $t[7], 'h' => hash('sha256', $token . $i), 'f' => '1.2.0'],
                );
            }
            // O primeiro leitor usa exatamente $token (os demais, $token . índice), para teste simples.
            Database::exec('UPDATE dispositivo SET token_hash = :h WHERE id = :id', ['h' => hash('sha256', $token), 'id' => $dispIds[0]]);

            // Aulas semanais: ~9 semanas atrás até 3 semanas à frente
            $totalAulas = 0;
            $totalRegistros = 0;
            foreach ($turmas as $idx => $t) {
                $n = 0;
                for ($off = -63; $off <= 21; $off++) {
                    $d = $hoje->modify(($off >= 0 ? '+' : '') . "$off days");
                    if ((int) $d->format('w') !== $t['dia']) {
                        continue;
                    }
                    $passada = $off < 0;
                    $cancelada = $passada && mt_rand() / mt_getrandmax() < 0.05;
                    $status = $cancelada ? 'cancelada' : ($passada ? 'finalizada' : 'agendada');
                    $aulaId = Database::insert(
                        'INSERT INTO aula (turma_id, `data`, inicio, fim, status, tema) VALUES (:t, :d, :i, :f, :s, :tema)',
                        ['t' => $t['id'], 'd' => $d->format('Y-m-d'), 'i' => $t['ini'], 'f' => $t['fim'], 's' => $status, 'tema' => self::TEMAS[$n % count(self::TEMAS)]],
                    );
                    $n++;
                    $totalAulas++;
                    if ($status !== 'finalizada') {
                        continue;
                    }
                    foreach ($matriculas[$t['id']] as $a) {
                        $r = mt_rand() / mt_getrandmax();
                        $reg = match (true) {
                            $r < $a['taxa']       => 'presente',
                            default               => mt_rand(1, 40) === 1 ? 'justificado' : 'ausente',
                        };
                        $inicio = new \DateTimeImmutable($d->format('Y-m-d') . ' ' . $t['ini']);
                        $quando = match ($reg) {
                            'presente'  => $inicio->modify(mt_rand(-12, 6) . ' minutes'),
                            default     => new \DateTimeImmutable($d->format('Y-m-d') . ' ' . $t['fim']),
                        };
                        $comLeitura = $reg === 'presente';
                        Database::insert(
                            'INSERT INTO registro (aula_id, usuario_id, data_hora_leitura, status, dispositivo_id, origem) VALUES (:a, :u, :q, :s, :d, :o)',
                            [
                                'a' => $aulaId, 'u' => $a['id'], 'q' => $quando->format('Y-m-d H:i:s'), 's' => $reg,
                                'd' => $comLeitura ? $dispIds[$idx] : null, 'o' => $comLeitura ? 'rfid' : ($reg === 'justificado' ? 'manual' : 'sistema'),
                            ],
                        );
                        $totalRegistros++;
                    }
                }
            }

            // O primeiro leitor "acabou de falar"; os demais ficam instável / offline para exercitar a tela.
            Database::exec('UPDATE dispositivo SET ultima_comunicacao = :t, ip = :ip WHERE id = :id', ['t' => date('Y-m-d H:i:s', time() - 20), 'ip' => '192.168.10.20', 'id' => $dispIds[0]]);
            Database::exec('UPDATE dispositivo SET ultima_comunicacao = :t, ip = :ip WHERE id = :id', ['t' => date('Y-m-d H:i:s', time() - 45), 'ip' => '192.168.10.21', 'id' => $dispIds[1]]);
            Database::exec('UPDATE dispositivo SET ultima_comunicacao = :t, ip = :ip WHERE id = :id', ['t' => date('Y-m-d H:i:s', time() - 600), 'ip' => '192.168.10.22', 'id' => $dispIds[2]]);
            Database::exec('UPDATE dispositivo SET ultima_comunicacao = :t, ip = :ip WHERE id = :id', ['t' => date('Y-m-d H:i:s', time() - 3600 * 50), 'ip' => '192.168.10.24', 'id' => $dispIds[4]]);

            return ['alunos' => count($alunos), 'aulas' => $totalAulas, 'registros' => $totalRegistros, 'tokenLeitor' => $token];
        });
    }

    /** "Ana Beatriz Souza" → ana.souza@aluno.edutag.edu.br */
    private static function email(string $nome): string
    {
        $semAcento = strtr($nome, [
            'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'õ' => 'o', 'ô' => 'o',
            'ú' => 'u', 'ç' => 'c', 'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ç' => 'C',
        ]);
        $partes = preg_split('/\s+/', strtolower(preg_replace('/[^A-Za-z\s]/', '', $semAcento) ?? '')) ?: [];
        return $partes[0] . '.' . end($partes) . '@aluno.edutag.edu.br';
    }
}
