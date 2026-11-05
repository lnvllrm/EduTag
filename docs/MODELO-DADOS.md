# EduTag — Entidades previstas no MySQL

Proposta derivada das telas e do contrato da API. Serve como ponto de partida para o back-end.

| Tabela | Principais colunas | Observações |
|---|---|---|
| `usuarios` | id, nome, email (único), senha_hash, perfil (`professor`/`aluno`), aluno_id (FK nulo, preenchido quando perfil = aluno), ativo | Login do sistema. Cada aluno tem um usuário vinculado ao seu cadastro |
| `alunos` | id, nome, matricula (única), email, curso, status | |
| `tags_rfid` | id, aluno_id (FK), uid (único), ativa, vinculada_em, desvinculada_em | Separada de `alunos` para permitir troca/perda de tag sem perder histórico. A API expõe a tag ativa como `tagUid` |
| `disciplinas` | id, codigo (único), nome, carga_horaria, descricao | |
| `turmas` | id, codigo (único), nome, disciplina_id (FK), professor_id (FK→usuarios), periodo, dia_semana, hora_inicio, hora_fim, sala | |
| `matriculas` | aluno_id (FK), turma_id (FK) — PK composta | N:N alunos × turmas |
| `aulas` | id, turma_id (FK), data, hora_inicio, hora_fim, tema, status (`agendada`/`realizada`/`cancelada`) | |
| `dispositivos` | id, codigo (único), nome, local, token_hash, firmware, ip, ultima_comunicacao | `status` (online/instável/offline) é **derivado** de `ultima_comunicacao` |
| `leituras_rfid` | id, dispositivo_id (FK), uid, lido_em, resultado (`registrada`/`duplicada`/`fora_de_horario`/`tag_desconhecida`), aluno_id (FK nulo), aula_id (FK nulo) | Log bruto e auditável, inclusive tags desconhecidas |
| `presencas` | id, aula_id (FK), aluno_id (FK), status (`presente`/`atrasado`/`falta`), registrado_em, dispositivo_id (FK nulo), origem (`rfid`/`manual`/`sistema`), leitura_id (FK nulo) | Único por (aula_id, aluno_id) |

Relações principais: `turmas 1—N aulas 1—N presencas N—1 alunos`; `alunos N—N turmas` via `matriculas`; `alunos 1—N tags_rfid`; `dispositivos 1—N leituras_rfid`.

Índices sugeridos: `presencas(aluno_id, aula_id)`, `aulas(turma_id, data)`, `leituras_rfid(dispositivo_id, lido_em)`, `tags_rfid(uid)`.
