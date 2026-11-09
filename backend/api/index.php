<?php
/**
 * EduTag — front controller da API.
 * Todas as URLs (ex.: /EduTag/backend/api/alunos/12) chegam aqui via .htaccess.
 */

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

\EduTag\App::run();
