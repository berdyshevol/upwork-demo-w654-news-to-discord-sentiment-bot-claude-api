"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EmbedPreview, { type PostState } from "@/components/EmbedPreview";
import SettingsDialog from "@/components/SettingsDialog";
import { clearByok, loadByok, saveByok } from "@/lib/byok";
import { buildDiscordEmbed } from "@/lib/embed";
import { evaluateHeadline, splitList } from "@/lib/filter";
import {
  defaultPrompt,
  defaultRules,
  ESTIMATED_COST_PER_CALL_USD,
} from "@/lib/seed";
import type {
  ByokConfig,
  FilterRules,
  Headline,
  LogRow,
  SentimentResult,
  Stage,
} from "@/lib/types";

type FeedState = "idle" | "running" | "paused" | "done";

const STAGE_STYLES: Record<Stage, string> = {
  ingested: "bg-zinc-700/50 text-zinc-300",
  filtered: "bg-sky-500/15 text-sky-300",
  analyzed: "bg-violet-500/15 text-violet-300",
  posted: "bg-emerald-500/15 text-emerald-300",
};

export default function Console() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [keywordsRaw, setKeywordsRaw] = useState(
    defaultRules.keywords.join(", ")
  );
  const [muteRaw, setMuteRaw] = useState(defaultRules.muteList.join(", "));
  const [minScoreRaw, setMinScoreRaw] = useState(
    String(defaultRules.minScore)
  );
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [byok, setByok] = useState<ByokConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [feedState, setFeedState] = useState<FeedState>("idle");
  const [ingestedIds, setIngestedIds] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, SentimentResult>>({});
  const [postStates, setPostStates] = useState<Record<string, PostState>>({});
  const [log, setLog] = useState<LogRow[]>([]);
  const [aiCalls, setAiCalls] = useState(0);

  const rules = useMemo<FilterRules>(
    () => ({
      keywords: splitList(keywordsRaw),
      muteList: splitList(muteRaw),
      minScore: Number(minScoreRaw) || 0,
    }),
    [keywordsRaw, muteRaw, minScoreRaw]
  );

  const verdicts = useMemo(
    () =>
      Object.fromEntries(
        headlines.map((h) => [h.id, evaluateHeadline(h, rules)])
      ),
    [headlines, rules]
  );

  // Refs so the streaming interval and async callbacks always see live values.
  const headlinesRef = useRef(headlines);
  headlinesRef.current = headlines;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const byokRef = useRef(byok);
  byokRef.current = byok;
  const cursorRef = useRef(0);
  const logIdRef = useRef(0);
  // Bumped on reset: stale async callbacks from a previous run are dropped.
  const genRef = useRef(0);

  useEffect(() => {
    setByok(loadByok());
    fetch("/api/headlines")
      .then((r) => r.json())
      .then((data) => setHeadlines(data.headlines ?? []))
      .catch(() => setHeadlines([]));
  }, []);

  function pushLog(
    headline: Headline,
    stage: Stage,
    note?: string,
    gen: number = genRef.current
  ) {
    if (gen !== genRef.current) return;
    const row: LogRow = {
      id: ++logIdRef.current,
      headlineId: headline.id,
      headlineTitle: headline.title,
      stage,
      at: new Date().toLocaleTimeString([], { hour12: false }),
      note,
    };
    setLog((l) => [...l, row]);
  }

  async function analyze(headline: Headline) {
    const gen = genRef.current;
    const started = performance.now();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          headlineId: headline.id,
          title: headline.title,
          body: headline.body,
          source: headline.source,
          prompt: promptRef.current,
          byok: byokRef.current,
        }),
      });
      const data = await res.json();
      if (gen !== genRef.current) return;
      if (!res.ok || !data.sentiment) {
        pushLog(headline, "analyzed", "analyze failed — no result", gen);
        return;
      }
      const latencyMs = Math.round(performance.now() - started);
      const result: SentimentResult = {
        sentiment: data.sentiment,
        confidence: data.confidence,
        reasoning: data.reasoning,
        mode: data.mode,
        isFallback: data.mode === "fallback",
        latencyMs,
      };
      if (data.mode !== "fallback") setAiCalls((c) => c + 1);
      setResults((r) => ({ ...r, [headline.id]: result }));
      pushLog(
        headline,
        "analyzed",
        `${data.sentiment} ${Math.round(data.confidence)}% · ${latencyMs} ms · ${data.mode}`,
        gen
      );
    } catch {
      pushLog(headline, "analyzed", "analyze route unreachable", gen);
    }
  }

  function ingest(headline: Headline) {
    pushLog(headline, "ingested");
    setIngestedIds((ids) =>
      ids.includes(headline.id) ? ids : [...ids, headline.id]
    );
    const v = evaluateHeadline(headline, rulesRef.current);
    pushLog(
      headline,
      "filtered",
      v.passed ? `passed — ${v.reason}` : `skipped — ${v.reason}`
    );
    if (v.passed) void analyze(headline);
  }

  useEffect(() => {
    if (feedState !== "running") return;
    const tick = () => {
      const list = headlinesRef.current;
      const i = cursorRef.current;
      if (list.length === 0) return;
      if (i >= list.length) {
        setFeedState("done");
        return;
      }
      cursorRef.current = i + 1;
      ingest(list[i]);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedState]);

  function reset() {
    genRef.current += 1;
    cursorRef.current = 0;
    setFeedState("idle");
    setIngestedIds([]);
    setResults({});
    setPostStates({});
    setLog([]);
    setAiCalls(0);
  }

  async function postToDiscord(headline: Headline) {
    const result = results[headline.id];
    if (!result) return;
    const gen = genRef.current;
    setPostStates((s) => ({ ...s, [headline.id]: { state: "sending" } }));
    try {
      const res = await fetch("/api/discord", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          embed: buildDiscordEmbed(headline, result),
        }),
      });
      const data = await res.json().catch(() => ({
        ok: false,
        error: "Unexpected response from the delivery route",
      }));
      if (gen !== genRef.current) return;
      if (data.ok) {
        setPostStates((s) => ({ ...s, [headline.id]: { state: "ok" } }));
        pushLog(headline, "posted", "delivered to Discord webhook", gen);
      } else {
        setPostStates((s) => ({
          ...s,
          [headline.id]: {
            state: "error",
            message: data.error ?? "Delivery failed",
          },
        }));
      }
    } catch {
      if (gen !== genRef.current) return;
      setPostStates((s) => ({
        ...s,
        [headline.id]: { state: "error", message: "Delivery route unreachable" },
      }));
    }
  }

  const ingested = ingestedIds.length;
  const skipped = ingestedIds.filter((id) => !verdicts[id]?.passed).length;
  const costSaved = (skipped * ESTIMATED_COST_PER_CALL_USD).toFixed(3);
  const analyzedEntries = Object.entries(results);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-100">
            Discord Sentiment Pipeline
            <span className="ml-2 text-sm font-normal text-zinc-500">
              live demo console
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            headline in → noise filter → AI sentiment read → color-coded
            Discord embed out. Every stage below is the real pipeline, made
            visible.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`chip ${
              byok
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border border-amber-500/40 bg-amber-500/10 text-amber-400"
            }`}
          >
            {byok ? `${byok.provider} · ${byok.model}` : "mock / fallback mode"}
          </span>
          <button
            data-testid="open-settings"
            className="btn-secondary"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Headlines ingested",
            testid: "counter-ingested",
            value: String(ingested),
          },
          {
            label: "Skipped by filter",
            testid: "counter-skipped",
            value: String(skipped),
          },
          {
            label: "AI calls made",
            testid: "counter-aicalls",
            value: String(aiCalls),
          },
          {
            label: "Est. AI spend avoided",
            testid: "counter-costsaved",
            value: `$${costSaved}`,
          },
        ].map((tile) => (
          <div key={tile.testid} className="panel px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {tile.label}
            </p>
            <p
              data-testid={tile.testid}
              className="mt-1 font-mono text-2xl font-semibold text-zinc-100"
            >
              {tile.value}
            </p>
          </div>
        ))}
      </section>

      <main className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr_1fr]">
        {/* ── Feed ─────────────────────────────────────────────── */}
        <section className="panel">
          <div className="panel-title">
            <span>Incoming feed · Financial Juice (seeded)</span>
            <div className="flex gap-1.5">
              <button
                data-testid="start-feed"
                className="btn-primary !px-2.5 !py-1 text-xs"
                disabled={
                  headlines.length === 0 ||
                  feedState === "running" ||
                  feedState === "done"
                }
                onClick={() => setFeedState("running")}
              >
                {feedState === "paused" ? "Resume" : "Start feed"}
              </button>
              <button
                data-testid="pause-feed"
                className="btn-secondary !px-2.5 !py-1 text-xs"
                disabled={feedState !== "running"}
                onClick={() => setFeedState("paused")}
              >
                Pause
              </button>
              <button
                data-testid="reset-feed"
                className="btn-secondary !px-2.5 !py-1 text-xs"
                onClick={reset}
              >
                Reset
              </button>
            </div>
          </div>
          <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
            {headlines.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-600">
                Loading seeded feed…
              </p>
            )}
            {headlines.map((h) => {
              const v = verdicts[h.id];
              const inPipeline = ingestedIds.includes(h.id);
              return (
                <article
                  key={h.id}
                  data-testid="feed-item"
                  className={`rounded-md border p-3 transition-colors ${
                    inPipeline
                      ? "border-indigo-500/40 bg-zinc-900"
                      : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-semibold text-zinc-400">
                      {h.source}
                    </span>
                    <span>{h.publishedAt.slice(11, 16)} UTC</span>
                    {h.tags.map((t) => (
                      <span key={t} className="rounded bg-zinc-800 px-1.5 py-px">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium leading-snug text-zinc-100">
                    {h.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {h.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      data-testid={`verdict-${h.id}`}
                      title={v?.matched.length ? `matched: ${v.matched.join(", ")}` : undefined}
                      className={`chip ${
                        v?.passed
                          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border border-zinc-700 bg-zinc-800/80 text-zinc-400"
                      }`}
                    >
                      {v
                        ? v.passed
                          ? `passes · score ${v.score}`
                          : `skipped · ${v.reason}`
                        : "…"}
                    </span>
                    <button
                      data-testid={`analyze-${h.id}`}
                      className="btn-secondary !px-2 !py-0.5 text-[11px]"
                      onClick={() => {
                        setIngestedIds((ids) =>
                          ids.includes(h.id) ? ids : [...ids, h.id]
                        );
                        void analyze(h);
                      }}
                    >
                      Analyze
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Controls ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="panel">
            <div className="panel-title">
              <span>Noise filter · runs before any AI call</span>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="field-label" htmlFor="keywords-input">
                  Keyword allow-list (comma-separated, 30 pts per match)
                </label>
                <textarea
                  id="keywords-input"
                  data-testid="keywords-input"
                  className="field-input font-mono text-xs"
                  rows={2}
                  value={keywordsRaw}
                  onChange={(e) => setKeywordsRaw(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="mutelist-input">
                  Mute-list (skip immediately)
                </label>
                <input
                  id="mutelist-input"
                  data-testid="mutelist-input"
                  className="field-input font-mono text-xs"
                  value={muteRaw}
                  onChange={(e) => setMuteRaw(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="minscore-input">
                  Minimum relevance score (0–100)
                </label>
                <input
                  id="minscore-input"
                  data-testid="minscore-input"
                  type="number"
                  min={0}
                  max={100}
                  className="field-input w-28"
                  value={minScoreRaw}
                  onChange={(e) => setMinScoreRaw(e.target.value)}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Edits re-filter the whole feed instantly — watch the verdict
                chips on the left flip. In production this same gate decides
                which headlines are worth an AI call.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <span>Sentiment prompt · sent with every AI call</span>
            </div>
            <div className="space-y-3 p-4">
              <textarea
                data-testid="prompt-input"
                className="field-input text-xs leading-relaxed"
                rows={7}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              {!byok && (
                <div
                  data-testid="byok-hint"
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-300"
                >
                  Mock mode: choose a provider and paste your API key in
                  Settings to enable live AI. Until then, passed headlines get
                  seeded fallback sentiments (flagged on each embed) so the
                  pipeline never stalls.
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <span>Discord delivery</span>
            </div>
            <div className="space-y-2 p-4">
              <label className="field-label" htmlFor="webhook-input">
                Your Discord webhook URL
              </label>
              <input
                id="webhook-input"
                data-testid="webhook-input"
                className="field-input font-mono text-xs"
                placeholder="https://discord.com/api/webhooks/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Server Settings → Integrations → Webhooks → New Webhook → Copy
                URL. The URL is held in memory for this session only and sent
                per-request; it is never stored or logged.
              </p>
            </div>
          </div>
        </section>

        {/* ── Embeds ───────────────────────────────────────────── */}
        <section className="panel">
          <div className="panel-title">
            <span>Discord embed previews · exact webhook payload</span>
          </div>
          <div className="max-h-[980px] space-y-3 overflow-y-auto p-3">
            {analyzedEntries.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-600">
                No analyses yet — press <strong>Start feed</strong> or Analyze a
                single headline.
              </p>
            )}
            {analyzedEntries.map(([id, result]) => {
              const headline = headlines.find((h) => h.id === id);
              if (!headline) return null;
              return (
                <EmbedPreview
                  key={id}
                  headline={headline}
                  result={result}
                  postState={postStates[id] ?? { state: "idle" }}
                  canPost={webhookUrl.trim().length > 0}
                  onPost={() => void postToDiscord(headline)}
                />
              );
            })}
          </div>
        </section>
      </main>

      {/* ── Pipeline log ───────────────────────────────────────── */}
      <section className="panel mt-4">
        <div className="panel-title">
          <span>Pipeline log · ingested → filtered → analyzed → posted</span>
          <span className="font-mono text-[11px] normal-case text-zinc-500">
            {log.length} events
          </span>
        </div>
        <div
          data-testid="pipeline-log"
          className="max-h-64 overflow-y-auto p-2 font-mono text-xs"
        >
          {log.length === 0 && (
            <p className="px-2 py-4 text-zinc-600">
              No pipeline activity yet — press Start feed.
            </p>
          )}
          {[...log].reverse().map((row) => (
            <div
              key={row.id}
              data-testid="log-row"
              data-stage={row.stage}
              className="flex items-baseline gap-2 rounded px-2 py-1 hover:bg-zinc-900"
            >
              <span className="shrink-0 text-zinc-600">{row.at}</span>
              <span
                className={`chip shrink-0 ${STAGE_STYLES[row.stage]} !rounded !px-1.5`}
              >
                {row.stage}
              </span>
              <span className="truncate text-zinc-400">
                {row.headlineTitle}
              </span>
              {row.note && (
                <span className="shrink-0 text-zinc-500">— {row.note}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-4 text-[11px] leading-relaxed text-zinc-600">
        This console is the production pipeline made inspectable: the always-on
        service runs the same filter → prompt → embed chain 24/7 against the
        live Financial Juice stream instead of this seeded feed. AI calls are
        BYOK — your key lives in your browser and bills only your own account.
      </footer>

      <SettingsDialog
        open={settingsOpen}
        current={byok}
        onSave={(config) => {
          saveByok(config);
          setByok(config);
        }}
        onClear={() => {
          clearByok();
          setByok(null);
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
