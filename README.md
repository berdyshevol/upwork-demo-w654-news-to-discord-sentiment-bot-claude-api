# Discord Sentiment Pipeline — Live Demo Console

A single-page console that proves the full news-to-Discord sentiment pipeline
end-to-end: **financial headline in → noise filter → AI sentiment read
(long / short / neutral + reasoning) → color-coded Discord embed out** — with
every stage visible, editable and testable in the browser.

## What it demonstrates

- **Seeded Financial Juice–style feed** (15 headlines mixing market movers and
  routine noise) streamed one-by-one with Start / Pause / Reset.
- **Relevance filter before any AI call** — keyword allow-list, mute-list and a
  minimum relevance score, all editable live; every headline gets a
  human-readable `passes` / `skipped` verdict (e.g. "no keyword match",
  "relevance 30 below threshold 40").
- **Editable sentiment prompt** used for every subsequent analysis — change it,
  re-analyze, and watch the reasoning change.
- **Server-side analyze route** returning Zod-validated structured JSON
  (`sentiment`, `confidence`, `reasoning`) via the Vercel AI SDK.
- **Pixel-faithful Discord embed previews**, color-coded green (long) / red
  (short) / gray (neutral) — and one-click **real delivery** to any Discord
  webhook URL the visitor pastes, with Discord errors surfaced.
- **Pipeline log** (`ingested → filtered → analyzed → posted`, with AI latency
  in ms) and counters showing headlines ingested, skipped, AI calls made and
  estimated AI spend avoided by the filter.
- **Never-dead demo**: with no API key (or on provider error) analyses fall
  back to seeded sentiments, clearly flagged with a `fallback` badge (FR11).

## BYOK — bring your own key

There is **no server-side API key anywhere**. AI calls run only with the
visitor's own credentials, entered in **Settings** (Anthropic / OpenAI /
Google + model picker). The config is stored as one JSON blob in the browser's
`localStorage` under `byok` and sent per-request to the analyze route — never
persisted or logged. Without a key the console runs fully in mock/fallback
mode.

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Tests

Behavioral Playwright tests cover every acceptance criterion in the PRD
(feed streaming through all four stages, live re-filtering, prompt-driven
reasoning changes, webhook delivery + error surfacing, counters, the BYOK
gate and the fallback path). Tests stub the LLM with a `mock` provider
sentinel in `localStorage.byok` — no real API key is ever needed.

```bash
pnpm exec playwright install --with-deps chromium   # once
pnpm test
```

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Vercel AI SDK
(`ai` + `@ai-sdk/anthropic` / `@ai-sdk/openai` / `@ai-sdk/google`) · Zod ·
Playwright.
