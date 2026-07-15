import type { FilterRules, Headline, Verdict } from "./types";

export const SCORE_PER_KEYWORD = 30;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A term matches at a word start so "rate" hits "rates" and "rate-cut" but
 * not "celebrates".
 */
function hits(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return new RegExp(`\\b${escapeRegExp(t)}`).test(text);
}

/**
 * Relevance filter, run before any AI call: mute-list wins, then keyword
 * hits score 30 each against the minimum relevance score.
 */
export function evaluateHeadline(h: Headline, rules: FilterRules): Verdict {
  const text = `${h.title} ${h.body}`.toLowerCase();

  const muted = rules.muteList.find((m) => hits(text, m));
  if (muted) {
    return {
      passed: false,
      score: 0,
      matched: [],
      reason: `muted keyword "${muted.trim().toLowerCase()}"`,
    };
  }

  const matched = rules.keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k, i, arr) => k && arr.indexOf(k) === i)
    .filter((k) => hits(text, k));
  const score = Math.min(100, matched.length * SCORE_PER_KEYWORD);

  if (matched.length === 0) {
    return { passed: false, score: 0, matched, reason: "no keyword match" };
  }
  if (score < rules.minScore) {
    return {
      passed: false,
      score,
      matched,
      reason: `relevance ${score} below threshold ${rules.minScore}`,
    };
  }
  return {
    passed: true,
    score,
    matched,
    reason: `matched ${matched.join(", ")} — score ${score}`,
  };
}

export function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
