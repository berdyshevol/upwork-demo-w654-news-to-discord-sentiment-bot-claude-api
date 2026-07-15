import type { Headline, Sentiment, SentimentResult } from "./types";

export const SENTIMENT_COLORS: Record<Sentiment, { hex: string; decimal: number; label: string }> = {
  long: { hex: "#57F287", decimal: 0x57f287, label: "LONG" },
  short: { hex: "#ED4245", decimal: 0xed4245, label: "SHORT" },
  neutral: { hex: "#95A5A6", decimal: 0x95a5a6, label: "NEUTRAL" },
};

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  footer: { text: string };
  timestamp: string;
}

/**
 * One embed shape shared by the on-page preview and the actual webhook POST,
 * so what the client previews is exactly what lands in their channel.
 */
export function buildDiscordEmbed(
  headline: Headline,
  result: SentimentResult
): DiscordEmbed {
  const color = SENTIMENT_COLORS[result.sentiment];
  return {
    title: headline.title,
    description: result.reasoning,
    color: color.decimal,
    fields: [
      { name: "Signal", value: color.label, inline: true },
      { name: "Confidence", value: `${Math.round(result.confidence)}%`, inline: true },
      { name: "Source", value: headline.source, inline: true },
    ],
    footer: {
      text: `Sentiment Pipeline · demo console${result.isFallback ? " · fallback result" : ""}`,
    },
    timestamp: new Date().toISOString(),
  };
}
