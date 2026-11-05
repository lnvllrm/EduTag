# EduTag — Contrato da API (front-end ⇄ PHP)

Este documento descreve o que o front-end **já espera** do back-end. O arquivo
`frontend/assets/js/mock/server.js` implementa exatamente este contrato em memória; o
back-end PHP precisa apenas respondê-lo igual.

## Convenções

- Base: `CONFIG.API_BASE` (`frontend/assets/js/config.js`). Ex.: `/edutag/api/`.
- Formato: JSON UTF-8. Datas `YYYY-MM-DD`, data/hora `YYYY-MM-DDTHH:MM:SS` (horário local do servidor), horas `HH:MM`.
- Autenticação: **sessão PHP por cookie** (`credentials: same-origin`). Sem sessão → `401`.
- Perfis: `professor` (visão total do sistema, inclusive cadastros) e `aluno` (somente os próprios dados). `auth/me` devolve `perfil` e, para aluno, `alunoId`.
- Autorização é **sempre do back-end** (o menu do front só esconde itens). Para o perfil **aluno**:
  - `presencas`, `aulas`, `turmas`, `alunos/{id}` e `alunos/{id}/frequencia` retornam **apenas** o que pertence a ele (ignorar `alunoId` enviado na query; `403` se pedir outro aluno);
  - `aulas` devolve `presenca: { status, registradoEm, dispositivo } | null` (a dele) **no lugar de** `resumo` (a chamada da turma);
  - todo o restante (cadastros, `dashboard`, `relatorios`, `dispositivos`, `leituras`, `turmas/{id}/alunos`) → `403`.
- Roteamento: caminhos REST (`alunos/12`). Em Apache/XAMPP use `.htaccess` com `mod_rewrite` apontando para um `api/index.php` (front controller). *(Decisão a confirmar no início do back-end.)*

### Sucesso
```json
{ "data": <objeto | lista>, "meta": { "total": 28, "page": 1, "perPage": 10, "totalPages": 3 } }
```

### Erro
```json
{ "error": { "code": "validation_error", "message": "Verifique os campos destacados.", "fields": { "matricula": "Já existe um aluno com esta matrícula." } } }
```
| HTTP | Uso |
|---|---|
| 401 | Sem sessão / credenciais inválidas (`code`: `unauthenticated`, `invalid_credentials`) |
| 403 | Sem permissão |
| 404 | Registro inexistente |
| 409 | Conflito de integridade (ex.: excluir turma com aulas) — `message` é exibida ao usuário |
| 422 | Validação — `fields` é exibido junto de cada campo do formulário |

### Listagens — parâmetros comuns
`page`, `perPage` (máx. 100), `q` (busca textual), `sort` (campo, aceita aninhado como `disciplina.nome`), `order` (`asc|desc`) + filtros específicos.

## Endpoints

| Método | Caminho | Descrição | Filtros / corpo |
|---|---|---|---|
| POST | `auth/login` | `{ email, senha }` → `{ usuario }` | — |
| GET | `auth/me` | Usuário da sessão `{ id, nome, email, perfil: "professor" ou "aluno", alunoId? }` | — |
| POST | `auth/logout` | Encerra a sessão | — |
| GET/POST | `alunos` | Lista / cadastra | `status`, `tag` (`com`\|`sem`), `turmaId`. Corpo: `nome, matricula, email, curso, status, tagUid` |
| GET/PUT/DELETE | `alunos/{id}` | Consulta / edita / exclui | — |
| GET | `alunos/{id}/frequencia` | `{ geral, porTurma[], historico[] }` | — |
| GET/POST | `disciplinas` | Lista (com `totalTurmas`) / cadastra | Corpo: `nome, codigo, cargaHoraria, descricao` |
| PUT/DELETE | `disciplinas/{id}` | Edita / exclui (409 se houver turmas) | — |
| GET/POST | `turmas` | Lista (com `disciplina`, `professor`, `totalAlunos`) / cadastra | `disciplinaId`. Corpo: `codigo, nome, disciplinaId, professorId, periodo, diaSemana, inicio, fim, sala` |
| PUT/DELETE | `turmas/{id}` | Edita / exclui (409 se houver aulas) | — |
| GET | `turmas/{id}/alunos` | Alunos matriculados | — |
| PUT | `turmas/{id}/alunos` | Substitui matrículas `{ alunoIds: [] }` | — |
| GET | `professores` | `[{ id, nome }]` para selects | — |
| GET/POST | `aulas` | Lista (com `turma`, `disciplina`, `resumo`) / cadastra | `turmaId`, `status`, `de`, `ate`. Corpo: `turmaId, data, inicio, fim, tema, status` |
| PUT/DELETE | `aulas/{id}` | Edita / exclui | — |
| GET | `presencas` | Lista **somente leitura** + `meta.resumo` | `alunoId`, `turmaId`, `disciplinaId`, `aulaId`, `status`, `de`, `ate`, `q` |
| GET | `dispositivos` | Dispositivos com `status`, `ultimaComunicacao`, `leiturasHoje` | **Integração futura** |
| GET | `leituras` | Log bruto de leituras | `dispositivoId`, `limit`. **Integração futura** |
| GET | `relatorios/frequencia` | Linhas por aluno×turma + `meta.{resumo,porTurma}` | `turmaId`, `disciplinaId`, `de`, `ate` |
| GET | `dashboard` | **Professor**: `kpis, presencaPorDia, frequenciaTurmas, alunosAtencao, proximasAulas, ultimaAula (chamada: ausentes/atrasados), leiturasRecentes`. O painel do aluno é montado no front com `alunos/{id}/frequencia` + `aulas` | — |

Os formatos exatos de cada resposta podem ser vistos em `frontend/assets/js/mock/server.js` (funções `*View`).

### Regras que o **back-end** deve implementar (o front só exibe)
- Unicidade de matrícula, e-mail, UID de tag e códigos; integridade referencial (409).
- `situacao` da frequência (`regular|atencao|risco`) e percentual: o mock usa ≥85% regular, ≥75% atenção, <75% risco — **confirmar a regra institucional**.
- Presença conta como comparecimento quando `presente` ou `atrasado`; janela de tolerância de atraso, leitura duplicada, leitura fora do horário.
- Autorização por perfil e por turma do professor.

## Integração RFID (futuro)
Fora do escopo do front. O Arduino deverá enviar o UID a um endpoint exclusivo (ex.: `POST rfid/leitura`, autenticado por token do dispositivo, **não** por sessão de usuário), que grava em `leituras_rfid`, resolve aluno/aula e gera a `presenca`. O front só consome `dispositivos`, `leituras` e `presencas`. Para "ao vivo", a tela de Dispositivos já possui *polling* opcional (`CONFIG.POLLING_MS`); WebSocket/SSE pode substituí-lo depois.
