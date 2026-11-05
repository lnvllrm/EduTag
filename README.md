# EduTag

Sistema inteligente de controle de presença com RFID (Arduino) — projeto acadêmico de Sistemas de Informação (Robótica).

**Estado atual:** front-end completo (HTML5 + CSS3 + JavaScript puro, sem frameworks nem build), operando sobre dados simulados. Back-end PHP/MySQL e integração com Arduino serão as próximas etapas.

## Estrutura do repositório

```
EduTag/
├── frontend/     Aplicação web (HTML/CSS/JS) — pronta, usando dados simulados
├── docs/         Arquitetura, contrato da API e modelo de dados
├── backend/      (futuro) API em PHP
├── database/     (futuro) scripts SQL do MySQL
├── firmware/     (futuro) código Arduino + leitor RFID
├── README.md
├── .gitignore · .gitattributes · .editorconfig
```

As pastas marcadas como *(futuro)* serão criadas quando cada etapa começar. A organização interna do front-end está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Como executar o front-end
O front usa módulos ES, então precisa ser servido por HTTP (não abra o HTML com duplo clique).

- **XAMPP**: copie/linke a pasta do projeto para `htdocs/EduTag` e acesse `http://localhost/EduTag/frontend/login.html`.
- **Sem XAMPP**: dentro da pasta `frontend/`, rode `npx serve .` ou `python -m http.server 8080` e acesse `http://localhost:8080/login.html`.

### Acesso de demonstração
Senha de todos os usuários de teste: `edutag123`

| Perfil | E-mail | O que vê |
|---|---|---|
| Professor | `carla.mendes@edutag.edu.br` | Tudo: alunos, turmas, aulas, calendário, presenças de **todos os alunos**, relatórios e dispositivos |
| Aluno | `ana.souza@aluno.edutag.edu.br` | **Somente os próprios dados**: painel, calendário de aulas, presenças e faltas |
| Aluno (com faltas) | `heitor.barbosa@aluno.edutag.edu.br` | Mesmo perfil, com frequência em risco para ver os alertas |

Qualquer aluno ativo entra com o e-mail institucional dele. As alterações ficam no `localStorage` do navegador; o menu do usuário tem "Restaurar dados de demonstração".

## Documentação
- [Arquitetura](docs/ARQUITETURA.md)
- [Contrato da API (PHP)](docs/API.md)
- [Modelo de dados (MySQL)](docs/MODELO-DADOS.md)
