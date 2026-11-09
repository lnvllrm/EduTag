<?php
/**
 * Finaliza as aulas que já terminaram e lança "ausente" para quem não passou a tag.
 * Agende para rodar a cada poucos minutos:
 *   Windows (Agendador de Tarefas):  C:\xampp\php\php.exe C:\xampp\htdocs\EduTag\backend\bin\encerrar-aulas.php
 *   Linux (cron):                    *\/5 * * * * php /var/www/EduTag/backend/bin/encerrar-aulas.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Execute pela linha de comando.\n");
}
require __DIR__ . '/../src/bootstrap.php';

$total = \EduTag\Services\AulaService::encerrarVencidas();
echo date('Y-m-d H:i:s') . " — $total aula(s) finalizada(s).\n";
