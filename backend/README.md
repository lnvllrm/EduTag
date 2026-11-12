# EduTag — Back-end (PHP)

API REST em **PHP 8.1+ puro** (sem Composer nem frameworks), com PDO/MySQL. Contrato em [`docs/API.md`](../docs/API.md); modelo em [`docs/MODELO-DADOS.md`](../docs/MODELO-DADOS.md).

```
backend/
├── api/            único diretório exposto na web: index.php (front controller) + .htaccess (mod_rewrite)
├── src/
│   ├── App.php         rotas, CORS, verificação de origem, tratamento global de erros
│   ├── bootstrap.php   autoload PSR-4 + fuso horário
│   ├── Core/           Config, Database (PDO), Router, Request, Response, Auth (sessão),
│   │                   Validator, Paginator, Fmt (tradução banco ⇄ API), ApiException
│   ├── Controllers/    um por recurso (HTTP + SQL)
│   └── Services/       regras: Frequencia, AulaService, RfidService, Presencas, DemoData
├── config/         config.example.php (versionado) · config.php (local, ignorado pelo Git)
├── bin/            scripts de linha de comando
├── tests/smoke.php teste ponta a ponta
└── dev-router.php  servidor embutido do PHP (sem Apache)
```

## Configuração
Copie `config/config.example.php` para `config/config.php`. Sem ele, vale o exemplo (padrão do XAMPP). Também aceita variáveis de ambiente `EDUTAG_DB_HOST/PORT/NAME/USER/PASS`. Aí ficam, além do banco: sessão, limite de login, **limiares de frequência (85% / 75%)**, janela de leitura RFID, tempo para o leitor ser considerado online/instável.

## Scripts (`php backend/bin/<script>`)
| Script | Para quê |
|---|---|
| `instalar.php [--demo] [--recriar]` | Cria banco e tabelas a partir de `database/schema.sql`; `--demo` insere dados de exemplo; `--recriar` apaga tudo (pede confirmação) |
| `criar-usuario.php --tipo= --ra= --nome= --email=` | Cria professor/administrador/aluno (a senha é digitada no prompt) |
| `dispositivo.php --codigo= --nome= --local=` | Cadastra um leitor e **imprime o token uma única vez** (`--novo-token` troca o token) |
| `encerrar-aulas.php` | Finaliza aulas vencidas e lança as faltas. **Agende a cada ~5 min** (Agendador de Tarefas do Windows / cron) |

## Integração do Arduino (resumo)
`POST /EduTag/backend/api/rfid/leitura` com `Authorization: Bearer <token>` e `{"uid":"A1B2C3D4"}`. Resposta e códigos em [`docs/API.md`](../docs/API.md#integração-rfid-arduino). O firmware precisa de um relógio? **Não**: a hora é a do servidor.

## Segurança — o que já está feito
- SQL somente com *prepared statements*; ordenação e busca por lista branca de colunas.
- Senhas com `password_hash` (bcrypt/argon, com *rehash* automático); token de leitor só como hash SHA-256.
- Sessão em cookie `HttpOnly` + `SameSite=Lax`, id regenerado no login, expiração por inatividade; usuário relido do banco a cada requisição (desativar a conta vale na hora).
- Proteção CSRF por verificação de `Origin` em requisições que alteram dados; CORS fechado por padrão.
- Limite de tentativas de login (429) e resposta uniforme para usuário inexistente/senha errada.
- Autorização sempre no servidor: o aluno só lê os próprios dados (`403` para os de outros; `alunoId` da URL é ignorado).
- Erros internos nunca vazam detalhes (`debug` desligado); `backend/.htaccess` nega acesso HTTP ao código e à configuração.

## Para colocar em produção
Use HTTPS (o cookie de sessão passa a `Secure` automaticamente), crie `config.php` com usuário de banco próprio (não `root`), **não** use `--demo`, e prefira apontar o servidor web só para `frontend/` e `backend/api/`.
