# EduTag — Contrato da API (front-end ⇄ PHP)

Contrato entre o front-end e o back-end PHP (`backend/`). Está **implementado** em
`backend/src/` e verificado por `backend/tests/smoke.php`. O mock
(`frontend/assets/js/mock/server.js`) segue o mesmo contrato e continua disponível para
demonstrar o front sem banco (`USE_MOCK: true` em `config.js`).

## Convenções

- Base: `CONFIG.API_BASE` (`frontend/assets/js/config.js`) = `../backend/api/` → `http://localhost/EduTag/backend/api/`.
- Formato: JSON UTF-8. Datas `YYYY-MM-DD`, data/hora `YYYY-MM-DDTHH:MM:SS` (horário local do servidor), horas `HH:MM`.
- Autenticação: **sessão PHP por cookie** (`credentials: same-origin`). Sem sessão → `401`.
- Perfis: `professor` (visão total do sistema, inclusive cadastros) e `aluno` (somente os próprios dados). `auth/me` devolve `perfil` e, para aluno, `alunoId`.
- Autorização é **sempre do back-end** (o menu do front só esconde itens). Para o perfil **aluno**:
  - `presencas`, `aulas`, `turmas`, `alunos/{id}` e `alunos/{id}/frequencia` retornam **apenas** o que pertence a ele (ignorar `alunoId` enviado na query; `403` se pedir outro aluno);
  - `aulas` devolve `presenca: { status, registradoEm, dispositivo } | null` (a dele) **no lugar de** `resumo` (a chamada da turma);
  - todo o restante (cadastros, `dashboard`, `relatorios`, `dispositivos`, `leituras`, `turmas/{id}/alunos`) → `403`.
- Roteamento: caminhos REST (`alunos/12`), via `backend/api/.htaccess` (`mod_rewrite`) → `index.php`. Sem Apache: `php -S localhost:8080 backend/dev-router.php`.
- Sessão: cookie `edutag_sid` (HttpOnly, SameSite=Lax). Requisições que alteram dados com cabeçalho `Origin` de outra origem recebem `403 forbidden_origin` (CSRF). Corpo sempre `application/json`.
- Perfil: `administrador` e `professor` (banco) chegam como `perfil: "professor"`. O login (`email`) também aceita a matrícula (RA).

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
| 401 | Sem sessão / credenciais inválidas (`unauthenticated`, `invalid_credentials`, `invalid_device_token`) |
| 403 | Sem permissão |
| 404 | Registro inexistente |
| 409 | Conflito de integridade (ex.: excluir turma com aulas) — `message` é exibida ao usuário |
| 422 | Validação — `fields` é exibido junto de cada campo do formulário |
| 429 | Muitas tentativas de login (5 falhas em 10 min por usuário + IP) |

### Listagens — parâmetros comuns
`page`, `perPage` (máx. 100), `q` (busca textual), `sort` (campo, aceita aninhado como `disciplina.nome`), `order` (`asc|desc`) + filtros específicos.

## Endpoints

| Método | Caminho | Descrição | Filtros / corpo |
|---|---|---|---|
| POST | `auth/login` | `{ email, senha }` → `{ usuario }` | — |
| GET | `auth/me` | Usuário da sessão `{ id, nome, email, matricula, tipo, perfil: "professor" ou "aluno", alunoId?, senhaProvisoria }` | — |
| POST | `auth/logout` | Encerra a sessão | — |
| PUT | `auth/senha` | Troca a própria senha `{ senhaAtual, novaSenha }` (mín. 8) | Ainda sem tela no front |
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
| GET | `dispositivos` | Dispositivos com `status`, `ultimaComunicacao`, `leiturasHoje` | Cadastro: `bin/dispositivo.php` |
| GET | `leituras` | Log bruto de leituras | `dispositivoId`, `limit` |
| POST | `rfid/leitura` | **Arduino**: `{ uid }` (token do dispositivo, ver abaixo) | — |
| POST | `rfid/heartbeat` | **Arduino**: `{ firmware? }` avisa que está online | — |
| GET | `relatorios/frequencia` | Linhas por aluno×turma + `meta.{resumo,porTurma}` | `turmaId`, `disciplinaId`, `de`, `ate` |
| GET | `dashboard` | **Professor**: `kpis, presencaPorDia, frequenciaTurmas, alunosAtencao, proximasAulas, ultimaAula (chamada: ausentes/atrasados), leiturasRecentes`. O painel do aluno é montado no front com `alunos/{id}/frequencia` + `aulas` | — |

Os formatos exatos de cada resposta podem ser vistos em `frontend/assets/js/mock/server.js` (funções `*View`).

### Regras implementadas no back-end
- Unicidade de matrícula (`ra`), e-mail, UID de tag e códigos (`422` por campo); integridade referencial (`409`). Excluir aluno com registros, aula com presenças reais, disciplina com turmas ou turma com aulas retorna `409`.
- Frequência: comparecimento = `presente` + `atrasado`; `justificado` não entra no denominador. Situação: ≥ 85% `regular`, ≥ 75% `atencao`, abaixo `risco` (**confirmar a regra institucional**; configurável em `config.php`). Os objetos de frequência incluem `justificadas`; os resumos de chamada, `justificados`.
- Status novos além do mock: aula `em_andamento`; presença `justificado`.
- Finalizar uma aula (`realizada`) lança `falta` (origem `sistema`) para os matriculados sem leitura; reabrir desfaz.
- Autorização por perfil. O professor enxerga todas as turmas (visão total); restringir por turma do professor é uma decisão futura.

## Integração RFID (Arduino)
Autenticação **por token do dispositivo**, não por sessão: `Authorization: Bearer <token>`. O token é gerado por `php backend/bin/dispositivo.php` e só o hash SHA-256 fica no banco.

```http
POST /EduTag/backend/api/rfid/leitura
Authorization: Bearer 3f9a…(48 hex)
Content-Type: application/json

{ "uid": "A1:B2:C3:D4" }        // aceita : - e espaços; guardado como A1B2C3D4
```
```json
{ "data": { "resultado": "registrada", "mensagem": "Presença registrada.", "aluno": { "id": 6, "nome": "Ana Beatriz Souza" }, "status": "presente" } }
```
HTTP `200` sempre que a leitura foi processada; `data.resultado` é um de:

| resultado | Significado |
|---|---|
| `registrada` | Presença gravada (`status` = `presente` ou `atrasado`) |
| `duplicada` | O aluno já tem registro nessa aula |
| `fora_de_horario` | Tag válida, mas sem aula de hoje na janela [início − 15 min, fim] |
| `tag_desconhecida` | Tag não vinculada a um aluno ativo |

`401 invalid_device_token` (token ausente/inválido) e `422` (UID malformado) indicam erro do equipamento. Toda leitura é gravada em `leitura_rfid`. `POST rfid/heartbeat` (`{ "firmware": "1.2.0" }`) mantém o leitor "online" quando não há leituras. A tela de Dispositivos lê `dispositivos` e `leituras`; o *polling* opcional (`CONFIG.POLLING_MS`) pode ser trocado por WebSocket/SSE depois.
