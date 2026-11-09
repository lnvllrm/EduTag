<?php
declare(strict_types=1);

namespace EduTag\Core;

/**
 * Busca (q), ordenação (sort/order) e paginação (page/perPage) das listagens,
 * sempre por lista branca de colunas: o nome vindo da URL nunca entra no SQL.
 */
final class Paginator
{
    /**
     * @param string       $select   colunas (já com aliases)
     * @param string       $from     FROM + JOINs
     * @param list<string> $where    condições já com placeholders únicos
     * @param array        $params   valores dos placeholders
     * @param array{search?:list<string>,sortable:array<string,string>,defaultSort:string,defaultOrder?:string,tieBreaker?:string} $opts
     * @return array{0:list<array>,1:array}  [linhas, meta]
     */
    public static function run(Request $req, string $select, string $from, array $where, array $params, array $opts): array
    {
        $q = $req->queryString('q');
        if ($q !== null && !empty($opts['search'])) {
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $parts = [];
            foreach ($opts['search'] as $i => $expr) {
                $parts[] = "$expr LIKE :_q$i";
                $params["_q$i"] = $like;
            }
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }

        $sortParam = $req->queryString('sort');
        $sortable = $opts['sortable'];
        $sortExpr = ($sortParam !== null && isset($sortable[$sortParam])) ? $sortable[$sortParam] : $sortable[$opts['defaultSort']];
        $order = $sortParam !== null ? $req->queryString('order') : ($opts['defaultOrder'] ?? 'asc');
        $dir = strtolower((string) $order) === 'desc' ? 'DESC' : 'ASC';
        $orderBy = "$sortExpr $dir" . (isset($opts['tieBreaker']) ? ", {$opts['tieBreaker']}" : '');

        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $total = (int) Database::value("SELECT COUNT(*) FROM $from $whereSql", $params);

        $perPage = max(1, min($req->queryInt('perPage') ?? 10, 100));
        $totalPages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($req->queryInt('page') ?? 1, $totalPages));
        $offset = ($page - 1) * $perPage;

        $rows = Database::all("SELECT $select FROM $from $whereSql ORDER BY $orderBy LIMIT $perPage OFFSET $offset", $params);
        return [$rows, ['total' => $total, 'page' => $page, 'perPage' => $perPage, 'totalPages' => $totalPages]];
    }
}
