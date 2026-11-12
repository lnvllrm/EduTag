# EduTag — Arquitetura

## Perfis
| Perfil | Acesso |
|---|---|
| **Administrador** | Gestão total: cadastra alunos, professores, disciplinas, turmas e aulas (inclusive repetição semanal até o fim do semestre), gerencia dispositivos RFID e vê todas as métricas |
| **Professor** | Somente consulta, e só do que é das turmas dele (`turma.professor_id`): dashboard, alunos, turmas, aulas, calendário, presenças e relatórios. Não cria nem edita nada |
| **Aluno** | Somente os próprios dados: painel pessoal, calendário de aulas com a própria presença/falta, minhas presenças, minha frequência e minhas turmas |

O menu (`layout/nav.js`) muda por perfil e as telas adaptam colunas, filtros e textos. O isolamento real dos dados é do back-end (`403` / filtro por aluno) — implementado em `backend/src/` e coberto por `backend/tests/smoke.php`; o mock em `mock/server.js` o espelha para demonstrar o front sem banco.

## Princípios
1. **Separação**: HTML (estrutura mínima) · CSS (tokens → base → layout → componentes → páginas) · JS (módulos ES).
2. **Um único ponto de contato com o back-end**: `frontend/assets/js/api/client.js`. Nenhuma página chama `fetch` diretamente.
3. **Dados simulados isolados** em `frontend/assets/js/mock/` e removíveis sem tocar no resto.
4. **Sem regras de negócio no front**: apenas validação de formato; o restante vem do back-end como erros de campo (`422`) ou conflitos (`409`).

## Estrutura
```
EduTag/
├── frontend/                     ← esta aplicação
│   ├── login.html · index.html · alunos.html · aluno.html · turmas.html · disciplinas.html
│   ├── aulas.html · calendario.html · presencas.html · dispositivos.html · relatorios.html
│   └── assets/
│       ├── css/   tokens · base · layout · components · pages
│       ├── img/   logo.svg
│       └── js/
│           ├── config.js        API_BASE, USE_MOCK, paginação, polling
│           ├── utils.js         formatação de datas/números, CSV, helpers
│           ├── api/             client.js (fetch) + um módulo por recurso
│           ├── mock/            data.js (semente) + server.js (API simulada)  ← descartável
│           ├── layout/          shell.js (sidebar/topbar), nav.js, session.js, theme.js
│           ├── ui/              dom, icons, brand, toast, modal, form, table, states, badges, charts, crud-page
│           ├── schemas/         definições de campos/opções compartilhadas
│           └── pages/           um módulo por tela
├── backend/                      API em PHP 8.1+ (ver backend/README.md)
│   ├── api/        index.php + .htaccess (única pasta exposta)
│   ├── src/        Core · Controllers · Services
│   ├── config/ · bin/ · tests/
├── database/                     schema.sql (MySQL/MariaDB)
├── docs/                         arquitetura, contrato da API, modelo de dados
└── firmware/  (futuro)           código Arduino + leitor RFID
```

## Como uma tela é montada
`pagina.html` carrega o CSS e um `<script type="module">` → `pages/x.js` chama `initPage()` (checa sessão e perfil, desenha a casca) e preenche a área de conteúdo usando os recursos de `api/`. Telas de listagem usam `ui/crud-page.js` (busca, filtros, ordenação, paginação, modal de cadastro/edição, confirmação de exclusão, estados de carregamento/vazio/erro, toasts).

## Back-end e camadas
`App` (rotas, CORS, origem, erros) → `Router` (perfil exigido por rota) → `Controllers` (HTTP, validação via `Validator`, SQL com PDO) → `Services` (regras reutilizáveis: frequência, ciclo da aula, leitura RFID). O banco usa o vocabulário da equipe (`ausente`, `finalizada`); a API usa o do front (`falta`, `realizada`) e a tradução fica só em `Core/Fmt.php`. Detalhes e segurança em [backend/README.md](../backend/README.md).

## Alternar entre back-end real e mock
Em `frontend/assets/js/config.js`: `USE_MOCK: false` + `API_BASE: ../backend/api/` (padrão) usam o PHP; `USE_MOCK: true` usa os dados simulados. Nenhuma página muda. Quando as páginas virarem `.php`, `layout/shell.js` pode ser substituído por `header.php`/`footer.php`.

## O que ainda depende do hardware / de decisões
| Item | Situação |
|---|---|
| Firmware do Arduino enviando `POST rfid/leitura` | **Pendente** — endpoint, token por leitor e regras prontos e testados |
| Botão "Ler do leitor" ao vincular tag | **Pendente** — precisa de um canal leitor → navegador (hoje o UID é digitado/colado) |
| Status e "ao vivo" dos leitores | Funciona por *polling*; depende do firmware chamar `rfid/heartbeat` |
| Limiares de frequência (85% / 75%) e tratamento de falta justificada | **Confirmar** com a coordenação (`config.php`) |
| Troca de senha pelo usuário | API pronta (`PUT auth/senha`); falta a tela |
| Exportação em PDF | Hoje: CSV e impressão do navegador |

## Acessibilidade e responsividade
Navegação por teclado e foco visível, `<dialog>` nativo nos modais, `aria-live` nos toasts, link "Ir para o conteúdo", tabelas viram cartões em telas pequenas, menu lateral vira gaveta abaixo de 1024px, tema claro/escuro (com respeito a `prefers-color-scheme`) e `prefers-reduced-motion`.
