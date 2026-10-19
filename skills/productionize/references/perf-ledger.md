# Performance ledger template (PERF.md)

Method: Lighthouse (`--only-categories=performance`, mobile) against a production build
(`next build && next start`) on `http://localhost:3000`. Throttle: simulated slow 4G, 4x CPU.
Machine noise is ±0.2s LCP / ±300ms TBT, so a delta smaller than that is not a win. Record
the machine and date with the baseline.

## Baseline (before this pass)

| Route | Score | LCP | CLS | TBT |
|---|---|---|---|---|
| `/` | | | | |
| `/search` | | | | |

## Kept

| Change | Baseline → Result | Why |
|---|---|---|
| | | |

## Reverted

| Idea | Baseline → Result | Why |
|---|---|---|
| | | |

## After this pass

| Route | Score | LCP | CLS | TBT |
|---|---|---|---|---|
| `/` | | | | |

## Open, not yet attempted

- LCP is still poor because ... (needs a trace, not a guess)
- Unbounded caches to bound (TTL + LRU)
- Indexes: only add if the composite PK does not already lead with the column

## Rules

- Do not apply `priority` to images unless the LCP element is actually an image. Measure first;
  the LCP is often the `<h1>`.
- Prefer `content-visibility: auto` before TanStack Virtual; virtualize only genuinely long lists.
- Cache external fetches with a TTL and an LRU bound, not an unbounded `Map`.
- Re-measure after each change and record the delta. Revert if no measurable win.
- Group/join in O(n) instead of O(n²); cap unbounded `select("*")` with a default limit + ordering.
- `h-full` on panels that resize after data resolves (CLS fix).
- Reserve height for loading states to avoid CLS.
- Lazy-load heavy panels; `optimizePackageImports` for heavy icon/component libs.
