-- =============================================================================
--  EduTag — Esquema do banco de dados (MySQL 8 / MariaDB 10.4+)
--
--  Base: modelo "chamada_rfid" definido pela equipe (usuario, disciplina, turma,
--  matricula, aula, dispositivo, registro). As linhas marcadas com [EDUTAG] são
--  extensões necessárias para a aplicação (front-end + integração RFID).
--
--  Importação: phpMyAdmin → Importar, ou
--      mysql -u root < database/schema.sql
--  Para recriar do zero, apague o banco antes:  DROP DATABASE chamada_rfid;
-- =============================================================================

CREATE DATABASE IF NOT EXISTS chamada_rfid
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE chamada_rfid;

-- -----------------------------------------------------------------------------
-- 1. usuario — alunos, professores e administradores
--    ra        → "matrícula" exibida no sistema
--    tag_uid   → UID da tag RFID vinculada (normalizado: HEX maiúsculo, sem separadores)
--    O perfil do front é derivado de "tipo": aluno → "aluno"; professor e
--    administrador → "professor" (visão e gestão totais).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    ra                  VARCHAR(20)  NOT NULL UNIQUE,
    nome                VARCHAR(100) NOT NULL,
    tipo                ENUM('aluno', 'professor', 'administrador') NOT NULL,
    senha_hash          VARCHAR(255) NOT NULL,
    tag_uid             VARCHAR(50)  UNIQUE,
    ativo               TINYINT(1)   NOT NULL DEFAULT 1,
    email               VARCHAR(150) NULL UNIQUE,                      -- [EDUTAG] login
    curso               VARCHAR(100) NULL,                             -- [EDUTAG]
    tag_vinculada_em    DATETIME     NULL,                             -- [EDUTAG]
    senha_provisoria    TINYINT(1)   NOT NULL DEFAULT 0,               -- [EDUTAG] 1 = precisa trocar a senha
    criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- [EDUTAG]
    INDEX idx_usuario_tipo (tipo, ativo)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. disciplina
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disciplina (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    codigo          VARCHAR(20)  NOT NULL UNIQUE,
    carga_horaria   INT          NOT NULL,
    descricao       TEXT         NULL                                  -- [EDUTAG]
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. turma — disciplina + professor (professor_id → usuario.id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turma (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nome            VARCHAR(50)  NOT NULL,
    disciplina_id   INT          NOT NULL,
    professor_id    INT          NOT NULL,
    codigo          VARCHAR(20)  NOT NULL UNIQUE,                      -- [EDUTAG]
    periodo         VARCHAR(10)  NOT NULL,                             -- [EDUTAG] ex.: 2026.2
    dia_semana      TINYINT      NOT NULL DEFAULT 1,                   -- [EDUTAG] 0 = domingo … 6 = sábado
    hora_inicio     TIME         NOT NULL,                             -- [EDUTAG]
    hora_fim        TIME         NOT NULL,                             -- [EDUTAG]
    sala            VARCHAR(60)  NULL,                                 -- [EDUTAG]

    CONSTRAINT fk_turma_disciplina FOREIGN KEY (disciplina_id) REFERENCES disciplina(id),
    CONSTRAINT fk_turma_professor  FOREIGN KEY (professor_id)  REFERENCES usuario(id),
    INDEX idx_turma_professor (professor_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. matricula — N:N entre usuários (alunos) e turmas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matricula (
    usuario_id  INT NOT NULL,
    turma_id    INT NOT NULL,

    PRIMARY KEY (usuario_id, turma_id),

    CONSTRAINT fk_matricula_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id),
    CONSTRAINT fk_matricula_turma   FOREIGN KEY (turma_id)   REFERENCES turma(id),
    INDEX idx_matricula_turma (turma_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. aula
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aula (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    turma_id    INT  NOT NULL,
    `data`      DATE NOT NULL,
    inicio      TIME NOT NULL,
    fim         TIME NOT NULL,
    status      ENUM('agendada', 'em_andamento', 'finalizada', 'cancelada') NOT NULL DEFAULT 'agendada',
    tema        VARCHAR(150) NULL,                                     -- [EDUTAG]

    CONSTRAINT fk_aula_turma FOREIGN KEY (turma_id) REFERENCES turma(id),
    INDEX idx_aula_turma_data (turma_id, `data`),
    INDEX idx_aula_data (`data`, status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. dispositivo — leitores RFID (Arduino)
--    O "status" (online/instável/offline) NÃO é gravado: é derivado de ultima_comunicacao.
--    O token nunca é guardado em claro: só o hash SHA-256 (ver bin/dispositivo.php).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispositivo (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    nome                VARCHAR(100) NOT NULL,
    `local`             VARCHAR(100) NOT NULL,
    ultima_comunicacao  DATETIME NULL,
    codigo              VARCHAR(30)  NOT NULL UNIQUE,                  -- [EDUTAG]
    token_hash          CHAR(64)     NOT NULL,                         -- [EDUTAG]
    firmware            VARCHAR(20)  NULL,                             -- [EDUTAG]
    ip                  VARCHAR(45)  NULL,                             -- [EDUTAG]
    ativo               TINYINT(1)   NOT NULL DEFAULT 1,               -- [EDUTAG]
    UNIQUE KEY uq_dispositivo_token (token_hash)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. registro — presença do aluno em uma aula
--    Único por (aula, aluno). dispositivo_id é opcional (lançamento manual / sistema).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registro (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    aula_id             INT NOT NULL,
    usuario_id          INT NOT NULL,
    data_hora_leitura   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status              ENUM('presente', 'atrasado', 'ausente', 'justificado') NOT NULL DEFAULT 'presente',
    dispositivo_id      INT NULL,
    origem              ENUM('rfid', 'manual', 'sistema') NOT NULL DEFAULT 'rfid', -- [EDUTAG]

    CONSTRAINT fk_registro_aula        FOREIGN KEY (aula_id)        REFERENCES aula(id),
    CONSTRAINT fk_registro_usuario     FOREIGN KEY (usuario_id)     REFERENCES usuario(id),
    CONSTRAINT fk_registro_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivo(id) ON DELETE SET NULL,
    UNIQUE KEY uq_registro_aula_usuario (aula_id, usuario_id),         -- [EDUTAG] impede presença duplicada
    INDEX idx_registro_usuario (usuario_id, aula_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. leitura_rfid — [EDUTAG] log bruto e auditável de TODA leitura recebida,
--    inclusive duplicadas, fora do horário e tags desconhecidas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leitura_rfid (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dispositivo_id  INT NOT NULL,
    uid             VARCHAR(50) NOT NULL,
    lido_em         DATETIME    NOT NULL,
    resultado       ENUM('registrada', 'duplicada', 'fora_de_horario', 'tag_desconhecida') NOT NULL,
    usuario_id      INT NULL,
    aula_id         INT NULL,
    registro_id     INT NULL,

    CONSTRAINT fk_leitura_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivo(id),
    CONSTRAINT fk_leitura_usuario     FOREIGN KEY (usuario_id)     REFERENCES usuario(id) ON DELETE SET NULL,
    CONSTRAINT fk_leitura_aula        FOREIGN KEY (aula_id)        REFERENCES aula(id)    ON DELETE SET NULL,
    CONSTRAINT fk_leitura_registro    FOREIGN KEY (registro_id)    REFERENCES registro(id) ON DELETE SET NULL,
    INDEX idx_leitura_lido_em (lido_em),
    INDEX idx_leitura_dispositivo (dispositivo_id, lido_em)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. tentativa_login — [EDUTAG] limita tentativas de senha (força bruta)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tentativa_login (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    identificador   VARCHAR(150) NOT NULL,
    ip              VARCHAR(45)  NOT NULL,
    criada_em       DATETIME     NOT NULL,
    INDEX idx_tentativa (identificador, ip, criada_em)
) ENGINE=InnoDB;
