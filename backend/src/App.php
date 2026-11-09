<?php
declare(strict_types=1);

namespace EduTag;

use EduTag\Controllers\{AlunoController, AulaController, AuthController, DashboardController, DisciplinaController, DispositivoController,
    PresencaController, RelatorioController, RfidController, TurmaController};
use EduTag\Core\{ApiException, Config, Request, Response, Router};
use Throwable;

/** Front controller da API: aplica as proteções globais, despacha a rota e padroniza erros. */
final class App
{
    public static function run(): void
    {
        ini_set('display_errors', '0'); // nunca vaza erro de PHP no corpo JSON

        try {
            $request = Request::capture();
            self::cors($request);
            if ($request->method === 'OPTIONS') {
                http_response_code(204);
                return;
            }
            self::verificarOrigem($request);
            $response = self::routes()->dispatch($request);
        } catch (ApiException $e) {
            $response = Response::error($e->status, $e->errorCode, $e->getMessage(), $e->fields);
        } catch (Throwable $e) {
            error_log(sprintf('[EduTag] %s: %s em %s:%d', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
            $debug = (bool) Config::get('app.debug', false);
            $response = Response::error(500, 'server_error', $debug ? $e->getMessage() : 'Erro interno do servidor. Tente novamente mais tarde.');
        }
        $response->send();
    }

    public static function routes(): Router
    {
        $r = new Router();
        $all = Router::ALL;

        // Autenticação
        $r->add('POST', 'auth/login', [AuthController::class, 'login'], null);
        $r->add('POST', 'auth/logout', [AuthController::class, 'logout'], null);
        $r->add('GET', 'auth/me', [AuthController::class, 'me'], $all);
        $r->add('PUT', 'auth/senha', [AuthController::class, 'alterarSenha'], $all);

        // Alunos
        $r->add('GET', 'alunos', [AlunoController::class, 'listar']);
        $r->add('POST', 'alunos', [AlunoController::class, 'criar']);
        $r->add('GET', 'alunos/{id}', [AlunoController::class, 'mostrar'], $all);
        $r->add('PUT', 'alunos/{id}', [AlunoController::class, 'atualizar']);
        $r->add('DELETE', 'alunos/{id}', [AlunoController::class, 'excluir']);
        $r->add('GET', 'alunos/{id}/frequencia', [AlunoController::class, 'frequencia'], $all);

        // Disciplinas
        $r->add('GET', 'disciplinas', [DisciplinaController::class, 'listar']);
        $r->add('POST', 'disciplinas', [DisciplinaController::class, 'criar']);
        $r->add('PUT', 'disciplinas/{id}', [DisciplinaController::class, 'atualizar']);
        $r->add('DELETE', 'disciplinas/{id}', [DisciplinaController::class, 'excluir']);

        // Turmas
        $r->add('GET', 'professores', [TurmaController::class, 'professores']);
        $r->add('GET', 'turmas', [TurmaController::class, 'listar'], $all);
        $r->add('POST', 'turmas', [TurmaController::class, 'criar']);
        $r->add('PUT', 'turmas/{id}', [TurmaController::class, 'atualizar']);
        $r->add('DELETE', 'turmas/{id}', [TurmaController::class, 'excluir']);
        $r->add('GET', 'turmas/{id}/alunos', [TurmaController::class, 'alunos']);
        $r->add('PUT', 'turmas/{id}/alunos', [TurmaController::class, 'definirAlunos']);

        // Aulas
        $r->add('GET', 'aulas', [AulaController::class, 'listar'], $all);
        $r->add('POST', 'aulas', [AulaController::class, 'criar']);
        $r->add('PUT', 'aulas/{id}', [AulaController::class, 'atualizar']);
        $r->add('DELETE', 'aulas/{id}', [AulaController::class, 'excluir']);

        // Presenças (somente leitura), relatórios e painel
        $r->add('GET', 'presencas', [PresencaController::class, 'listar'], $all);
        $r->add('GET', 'relatorios/frequencia', [RelatorioController::class, 'frequencia']);
        $r->add('GET', 'dashboard', [DashboardController::class, 'resumo']);

        // Dispositivos e leituras (consulta)
        $r->add('GET', 'dispositivos', [DispositivoController::class, 'listar']);
        $r->add('GET', 'leituras', [DispositivoController::class, 'leituras']);

        // Arduino — autenticação por token do dispositivo (não por sessão)
        $r->add('POST', 'rfid/leitura', [RfidController::class, 'leitura'], null);
        $r->add('POST', 'rfid/heartbeat', [RfidController::class, 'heartbeat'], null);

        return $r;
    }

    /** CORS somente para origens explicitamente autorizadas em config.php. */
    private static function cors(Request $request): void
    {
        $origin = $request->header('origin');
        $allowed = (array) Config::get('app.allowed_origins', []);
        if ($origin !== null && in_array($origin, $allowed, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Vary: Origin');
        }
    }

    /**
     * Defesa contra CSRF: requisições que alteram dados e trazem o cabeçalho Origin
     * precisam vir da mesma origem (ou de uma origem autorizada). O cookie de sessão
     * também é SameSite=Lax. O Arduino não envia Origin e não usa cookie.
     */
    private static function verificarOrigem(Request $request): void
    {
        if (in_array($request->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $origin = $request->header('origin');
        if ($origin === null) {
            return;
        }
        $host = parse_url($origin, PHP_URL_HOST);
        $port = parse_url($origin, PHP_URL_PORT);
        $originHost = $host . ($port ? ":$port" : '');
        $serverHost = $_SERVER['HTTP_HOST'] ?? '';
        if ($originHost !== $serverHost && !in_array($origin, (array) Config::get('app.allowed_origins', []), true)) {
            throw new ApiException(403, 'forbidden_origin', 'Origem não autorizada.');
        }
    }
}
