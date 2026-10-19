# SEO and discoverability checklist

## Metadata

- [ ] Root metadata in the root layout (title, description, openGraph, twitter, metadataBase).
- [ ] Per-route metadata for each page (title template, description).
- [ ] One `SITE_URL` constant (`lib/site.ts`); canonical URLs and sitemap derive from it so
      they never drift.

## Route files

- [ ] `app/robots.ts`: search crawlers allowed; AI-search crawlers (GPTBot, ClaudeBot, PerplexityBot,
      etc.) explicitly allowed; model-training crawlers denied.
- [ ] `app/sitemap.ts`: lists public routes with lastModified.

## Structured data

- [ ] JSON-LD on key pages (WebApplication, FAQ, BreadcrumbList) rendered server-side.
- [ ] Rendered via `dangerouslySetInnerHTML` in a server component, with a biome override for that
      file (security rule off) scoped to that file only.

## Answer engines

- [ ] `public/llms.txt` and `public/llms-full.txt` describing the product for LLM crawlers.

## Performance hints

- [ ] `prefetchDNS` / `preconnect` for API hosts (iTunes, Supabase, CDN) in the root layout.

## Verification

- [ ] View source on `/` and a detail page: metadata present without JS.
- [ ] `curl /robots.txt`, `curl /sitemap.xml`, `curl /llms.txt` return expected content.
- [ ] Rich Results Test passes for JSON-LD pages.
- [ ] Measure for real (not Lighthouse alone): search-console / crawler logs.

## Anti-patterns

- Do not use NextSEO or hand-written head tags when the framework ships the primitives.
- Do not allow model-training crawlers if the content is proprietary.
- Do not let canonical URLs drift from the sitemap (single `SITE_URL` source).
