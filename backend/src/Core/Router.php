<?php
declare(strict_types=1);

namespace EduTag\Core;

/**
 * Roteador mínimo. Cada rota declara quais perfis podem acessá-la:
 *   null              → pública (login, rotas autenticadas por token de dispositivo)
 *   ['administrador']                → padrão: cadastros e configurações
 *   ['administrador','professor']    → consultas da equipe (o controller limita o professor às turmas dele)
 *   os três perfis                   → rotas compartilhadas (o controller limita professor e aluno)
 */
final class Router
{
    public const ALL = ['administrador', 'professor', 'aluno'];
    public const STAFF = ['administrador', 'professor'];
    public const ADMIN = ['administrador'];

    /** @var list<array{method:string,regex:string,handler:array,roles:?array}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array $handler, ?array $roles = self::ADMIN): void
    {
        $regex = preg_replace('#\{(\w+)\}#', '(?P<$1>[0-9]+)', $pattern);
        $this->routes[] = ['method' => $method, 'regex' => "#^{$regex}$#", 'handler' => $handler, 'roles' => $roles];
    }

    public function dispatch(Request $request): Response
    {
        $allowedMethods = [];
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $m)) {
                continue;
            }
            if ($route['method'] !== $request->method) {
                $allowedMethods[] = $route['method'];
                continue;
            }

            $user = null;
            if ($route['roles'] !== null) {
                $user = Auth::user();
                if ($user === null) {
                    throw ApiException::unauthenticated();
                }
                if (!in_array($user['perfil'], $route['roles'], true)) {
                    throw ApiException::forbidden();
                }
            }

            $params = array_map('intval', array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY));
            [$class, $method] = $route['handler'];
            return (new $class())->$method($request, $params, $user);
        }

        if ($allowedMethods) {
            throw new ApiException(405, 'method_not_allowed', 'Método não permitido para este endpoint.');
        }
        throw new ApiException(404, 'route_not_found', "Endpoint não encontrado: {$request->method} /{$request->path}");
    }
}
