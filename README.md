# EduTag

Sistema inteligente de controle de presença com RFID (Arduino) — projeto acadêmico de Sistemas de Informação (Robótica).

**Estado atual:** front-end (HTML5 + CSS3 + JavaScript puro) e **back-end em PHP 8.1+ com MySQL/MariaDB** (API REST, sem frameworks) prontos e integrados. Falta o firmware do Arduino (o endpoint que ele usará já existe e está testado).

## Estrutura do repositório

```
EduTag/
├── frontend/     Aplicação web (HTML/CSS/JS)
├── backend/      API em PHP (api/, src/, config/, bin/, tests/)
├── database/     schema.sql (MySQL/MariaDB)
├── docs/         Arquitetura, contrato da API e modelo de dados
├── firmware/     (futuro) código Arduino + leitor RFID
├── README.md
├── .gitignore · .gitattributes · .editorconfig
```

## Como executar (XAMPP)

Requisitos: **XAMPP com Apache + MySQL ligados** (PHP 8.1 ou mais novo).

1. Copie (ou clone) a pasta do projeto para `C:\xampp\htdocs\EduTag`.
2. Crie o banco e os dados de demonstração. No terminal, dentro de `C:\xampp\htdocs\EduTag`:
   ```
   C:\xampp\php\php.exe backend\bin\instalar.php --demo
   ```
   *(Alternativa: phpMyAdmin → Importar → `database/schema.sql`. Nesse caso crie os usuários com `backend\bin\criar-usuario.php`.)*
3. Só se o seu MySQL tiver senha ou porta diferente: copie `backend/config/config.example.php` para `backend/config/config.php` e ajuste. Sem esse arquivo vale o padrão do XAMPP (usuário `root`, sem senha, porta 3306, banco `chamada_rfid`).
4. Acesse **http://localhost/EduTag/frontend/login.html**.

**Sem XAMPP** (só PHP 8.1+ e um MySQL/MariaDB): na raiz do projeto rode `php -S localhost:8080 backend/dev-router.php` e acesse `http://localhost:8080/frontend/login.html`.

**Só o front, sem banco:** em `frontend/assets/js/config.js` troque `USE_MOCK` para `true` e sirva a pasta `frontend/` por qualquer servidor estático (os módulos ES não funcionam abrindo o HTML com duplo clique).

### Acesso de demonstração
Senha de todas as contas de teste: `edutag123`

| Perfil | E-mail | O que vê |
|---|---|---|
| Professor | `carla.mendes@edutag.edu.br` | Tudo: alunos, turmas, aulas, calendário, presenças de **todos os alunos**, relatórios e dispositivos |
| Administrador | `admin@edutag.edu.br` | Mesmo acesso do professor |
| Aluno | `ana.souza@aluno.edutag.edu.br` | **Somente os próprios dados**: painel, calendário, presenças e faltas |
| Aluno (com faltas) | `heitor.barbosa@aluno.edutag.edu.br` | Mesmo perfil, com frequência em risco para ver os alertas |

O login também aceita a matrícula (RA) no lugar do e-mail. Alunos cadastrados pelo sistema entram com a matrícula como senha inicial (marcada como provisória).
**Em produção, não use `--demo`**: crie o primeiro acesso com `backend\bin\criar-usuario.php`.

## Testes
```
C:\xampp\php\php.exe backend\tests\smoke.php http://localhost/EduTag/backend/api
```
Ponta a ponta sobre HTTP (login, permissões, CRUDs, validações, chamada, leitura RFID, relatórios, força bruta). **Rode apenas em banco de demonstração** — ele cria e remove registros "ZZ Teste".

## Documentação
- [Arquitetura](docs/ARQUITETURA.md)
- [Contrato da API e integração do Arduino](docs/API.md)
- [Modelo de dados](docs/MODELO-DADOS.md)
- [Back-end: instalação, scripts e segurança](backend/README.md)
