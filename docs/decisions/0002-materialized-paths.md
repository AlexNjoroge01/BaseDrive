# 2. Materialized paths for the folder tree

**Status:** accepted

## Context
The hot queries are "list a folder", "everything under X" (move, purge, trash visibility, link scope), and "ancestors of X" (permission inheritance, breadcrumbs).

## Options
- **Adjacency list only.** Simple writes, but subtree and ancestor queries need recursive CTEs on every request.
- **Closure table.** Fast reads, but O(depth × subtree) rows to rewrite on every move, plus a second table to keep consistent.
- **Materialized path.** `path = "/a/b/c/"`. A subtree is one indexed `LIKE 'prefix%'`; ancestors are parsed from the string with no query at all.

## Decision
Keep `parent_id` (for "list children") and add `path` with a `text_pattern_ops` btree index.

## Consequences
- A move costs one `UPDATE` over the subtree inside a transaction. Fine for a personal drive.
- Ids are fixed-format CUIDs, so `/` never appears inside a segment. Prefixes are still LIKE-escaped.
- Gotcha: `substring(path from $1)` with an untyped parameter resolves to the regex overload. Cast it: `$1::int`.
