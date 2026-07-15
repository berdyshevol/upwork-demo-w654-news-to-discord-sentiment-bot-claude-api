"use client";

import { SENTIMENT_COLORS } from "@/lib/embed";
import type { Headline, SentimentResult } from "@/lib/types";

export interface PostState {
  state: "idle" | "sending" | "ok" | "error";
  message?: string;
}

interface Props {
  headline: Headline;
  result: SentimentResult;
  postState: PostState;
  canPost: boolean;
  onPost: () => void;
}

/** Pixel-faithful Discord embed preview: what you see here is the exact payload sent to the webhook. */
export default function EmbedPreview({
  headline,
  result,
  postState,
  canPost,
  onPost,
}: Props) {
  const color = SENTIMENT_COLORS[result.sentiment];
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      data-testid={`embed-${headline.id}`}
      data-sentiment={result.sentiment}
      className="rounded-lg bg-[#313338] p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: color.hex, color: "#1e1f22" }}
        >
          SP
        </span>
        <span className="text-sm font-semibold text-zinc-100">
          Sentiment Pipeline
        </span>
        <span className="rounded bg-indigo-500 px-1 py-px text-[9px] font-bold uppercase text-white">
          Bot
        </span>
        <span className="text-[11px] text-zinc-400">today at {time}</span>
        {result.isFallback && (
          <span
            data-testid={`fallback-badge-${headline.id}`}
            className="chip border border-amber-500/40 bg-amber-500/10 text-amber-400"
            title="No API key configured or the provider call failed — seeded result"
          >
            fallback
          </span>
        )}
        {result.mode === "mock" && (
          <span className="chip border border-sky-500/40 bg-sky-500/10 text-sky-400">
            mock
          </span>
        )}
      </div>

      <div className="flex overflow-hidden rounded bg-[#2b2d31]">
        <div
          data-testid={`embed-bar-${headline.id}`}
          className="w-1 shrink-0"
          style={{ backgroundColor: color.hex }}
        />
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <p className="text-sm font-semibold leading-snug text-zinc-100">
            {headline.title}
          </p>
          <p
            data-testid={`embed-reasoning-${headline.id}`}
            className="mt-1.5 text-[13px] leading-relaxed text-zinc-300"
          >
            {result.reasoning}
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-zinc-200">Signal</p>
              <p className="text-[13px]" style={{ color: color.hex }}>
                {color.label}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-zinc-200">
                Confidence
              </p>
              <p className="text-[13px] text-zinc-300">
                {Math.round(result.confidence)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-zinc-200">Source</p>
              <p className="text-[13px] text-zinc-300">{headline.source}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-zinc-500">
            Sentiment Pipeline · demo console
            {result.isFallback ? " · fallback result" : ""} ·{" "}
            {result.latencyMs} ms
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          data-testid={`post-${headline.id}`}
          className="btn-secondary text-xs"
          disabled={!canPost || postState.state === "sending"}
          title={
            canPost
              ? "Deliver this exact embed to your Discord channel"
              : "Paste a Discord webhook URL first"
          }
          onClick={onPost}
        >
          {postState.state === "sending" ? "Posting…" : "Post to Discord"}
        </button>
        <span
          data-testid={`post-status-${headline.id}`}
          className={`text-xs ${
            postState.state === "ok"
              ? "text-emerald-400"
              : postState.state === "error"
                ? "text-red-400"
                : "text-zinc-500"
          }`}
        >
          {postState.state === "ok"
            ? "Posted to Discord"
            : postState.state === "error"
              ? postState.message
              : ""}
        </span>
      </div>
    </div>
  );
}
