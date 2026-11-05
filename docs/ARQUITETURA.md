# EduTag — Arquitetura do front-end

## Perfis
| Perfil | Acesso |
|---|---|
| **Professor** | Visão total: dashboard com métricas (quem veio e quem faltou), alunos, turmas, disciplinas, aulas, calendário (com chamada por aula), presenças de todos os alunos, relatórios e dispositivos |
| **Aluno** | Somente os próprios dados: painel pessoal, calendário de aulas com a própria presença/falta, minhas presenças, minha frequência e minhas turmas |

O menu (`layout/nav.js`) muda por perfil e as telas adaptam colunas, filtros e textos. O isolamento real dos dados é do back-end (`403` / filtro por aluno); o mock em `mock/server.js` já o aplica como especificação executável.

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
├── docs/                         arquitetura, contrato da API, modelo de dados
├── backend/   (futuro)           API em PHP
├── database/  (futuro)           scripts SQL (MySQL)
└── firmware/  (futuro)           código Arduino + leitor RFID
```

## Como uma tela é montada
`pagina.html` carrega o CSS e um `<script type="module">` → `pages/x.js` chama `initPage()` (checa sessão e perfil, desenha a casca) e preenche a área de conteúdo usando os recursos de `api/`. Telas de listagem usam `ui/crud-page.js` (busca, filtros, ordenação, paginação, modal de cadastro/edição, confirmação de exclusão, estados de carregamento/vazio/erro, toasts).

## Migração para o back-end real
1. Em `config.js`: `API_BASE` = raiz dos endpoints PHP e `USE_MOCK: false`.
2. Implementar os endpoints de `docs/API.md` (o mock é a especificação executável).
3. (Opcional) apagar `frontend/assets/js/mock/`.
4. Quando as páginas virarem `.php`, `layout/shell.js` pode ser substituído por `header.php`/`footer.php`; CSS e módulos de página permanecem.

## O que depende de integração futura (sinalizado na interface com selo/aviso)
| Funcionalidade | Onde | Depende de |
|---|---|---|
| Status e última comunicação dos leitores | Dispositivos, Dashboard | Arduino → back-end |
| Leituras recentes | Dispositivos, Dashboard | Arduino → back-end |
| Registro automático de presenças | Presenças | Arduino → back-end |
| Botão "Ler do leitor" ao vincular tag | Formulário de aluno | Leitor RFID |
| Autenticação real, autorização por perfil | Login, todas | PHP (sessão) |
| Exportação em PDF | Relatórios | PHP (hoje: CSV e impressão no navegador) |

## Acessibilidade e responsividade
Navegação por teclado e foco visível, `<dialog>` nativo nos modais, `aria-live` nos toasts, link "Ir para o conteúdo", tabelas viram cartões em telas pequenas, menu lateral vira gaveta abaixo de 1024px, tema claro/escuro (com respeito a `prefers-color-scheme`) e `prefers-reduced-motion`.
