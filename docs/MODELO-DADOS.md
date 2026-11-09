# EduTag — Modelo de dados (MySQL / MariaDB)

Fonte da verdade: [`database/schema.sql`](../database/schema.sql). O modelo parte do desenho da equipe
(`usuario`, `disciplina`, `turma`, `matricula`, `aula`, `dispositivo`, `registro`) e recebe só as
extensões que a aplicação precisa, marcadas com `[EDUTAG]` no próprio SQL.

## Tabelas

| Tabela | Papel | Colunas principais |
|---|---|---|
| `usuario` | Alunos, professores e administradores | `ra` (único; é a "matrícula" na interface), `nome`, `tipo` (`aluno`/`professor`/`administrador`), `senha_hash`, `tag_uid` (único), `ativo`, **`email`** (único; login), **`curso`**, **`tag_vinculada_em`**, **`senha_provisoria`**, **`criado_em`** |
| `disciplina` | Catálogo de disciplinas | `codigo` (único), `nome`, `carga_horaria`, **`descricao`** |
| `turma` | Disciplina + professor + horário | `disciplina_id`, `professor_id` → `usuario`, `nome`, **`codigo`** (único), **`periodo`**, **`dia_semana`** (0 = domingo), **`hora_inicio`**, **`hora_fim`**, **`sala`** |
| `matricula` | N:N aluno × turma | PK composta (`usuario_id`, `turma_id`) |
| `aula` | Encontros de uma turma | `turma_id`, `data`, `inicio`, `fim`, `status` (`agendada`/`em_andamento`/`finalizada`/`cancelada`), **`tema`** |
| `dispositivo` | Leitores RFID | `nome`, `local`, `ultima_comunicacao`, **`codigo`** (único), **`token_hash`**, **`firmware`**, **`ip`**, **`ativo`** |
| `registro` | Presença do aluno em uma aula | `aula_id`, `usuario_id`, `data_hora_leitura`, `status` (`presente`/`atrasado`/`ausente`/`justificado`), `dispositivo_id` (nulo), **`origem`** (`rfid`/`manual`/`sistema`) — **único por (`aula_id`, `usuario_id`)** |
| **`leitura_rfid`** | Log bruto de TODA leitura recebida | `dispositivo_id`, `uid`, `lido_em`, `resultado` (`registrada`/`duplicada`/`fora_de_horario`/`tag_desconhecida`), `usuario_id`, `aula_id`, `registro_id` |
| **`tentativa_login`** | Limite de tentativas de senha | `identificador`, `ip`, `criada_em` |

**Negrito** = acrescentado pelo EduTag ao modelo original.

## Por que as extensões

- `email`, `curso`, `senha_provisoria`: o front faz login por e-mail e exibe o curso; a senha inicial do aluno é a matrícula e deve ser trocada.
- `turma.codigo/periodo/dia_semana/hora_*/sala` e `aula.tema`, `disciplina.descricao`: campos exibidos e editados nas telas.
- `dispositivo.codigo/token_hash/firmware/ip/ativo`: o Arduino se autentica por token (guardado só como hash SHA-256) e informa firmware/IP.
- `registro.origem` e a chave única `(aula_id, usuario_id)`: distinguem leitura RFID, lançamento manual e falta gerada pelo sistema, e impedem presença duplicada mesmo com leituras simultâneas.
- `leitura_rfid`: trilha de auditoria; permite à tela de Dispositivos mostrar também leituras que **não** viraram presença (tag desconhecida, fora do horário, duplicada).

## Decisões de mapeamento

| Conceito | Banco | API / front |
|---|---|---|
| Matrícula do aluno | `usuario.ra` | `matricula` |
| Perfil | `tipo`: aluno → `aluno`; professor e administrador → `professor` | `perfil` (o front tem 2 perfis; administrador tem o acesso do professor) |
| Falta | `registro.status = 'ausente'` | `falta` |
| Aula realizada | `aula.status = 'finalizada'` | `realizada` |
| Status do leitor | **não é gravado**: derivado de `ultima_comunicacao` | `online` (≤ 2 min), `instavel` (≤ 15 min), `offline` |
| Situação da frequência | **não é gravada**: calculada | `regular` (≥ 85%), `atencao` (≥ 75%), `risco` |

A tradução `ausente↔falta` e `finalizada↔realizada` acontece em um único lugar: `backend/src/Core/Fmt.php`.
Limites configuráveis em `backend/config/config.php`.

## Regras que o back-end aplica

- **Frequência**: comparecimento = `presente` + `atrasado`. Falta `justificado` (abonada) **não entra no denominador** do percentual, mas aparece separada. *Confirmar com a coordenação*, assim como os limites 85% / 75%.
- **Finalizar a aula** (status `finalizada`) gera `ausente` (origem `sistema`) para todo aluno ativo matriculado sem registro; reabrir a aula desfaz essas faltas. `bin/encerrar-aulas.php` faz o mesmo automaticamente após o fim da aula.
- **Leitura RFID**: tag de aluno ativo → aula de hoje (agendada/em andamento) das turmas dele, na janela `[início − 15 min, fim]`; atraso após 15 min do início; segunda leitura = `duplicada`. Ver `backend/src/Services/RfidService.php`.
- **Exclusões**: aluno com registros, aula com presenças reais, disciplina com turmas e turma com aulas retornam `409` (preserva o histórico; para alunos, marque como inativo).

## Relações

`disciplina 1—N turma` · `usuario(professor) 1—N turma` · `turma 1—N aula 1—N registro N—1 usuario(aluno)` ·
`usuario N—N turma` via `matricula` · `dispositivo 1—N leitura_rfid` · `dispositivo 1—N registro (opcional)`.
