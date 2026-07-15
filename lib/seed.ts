import type { FilterRules, Headline, Sentiment } from "./types";

/**
 * Seeded stand-in for the Financial Juice stream: ~15 headlines from the
 * morning of 2026-07-15, deliberately mixing market-moving news with routine
 * noise so the relevance filter has real work to do.
 */
export const headlines: Headline[] = [
  {
    id: "h1",
    source: "Reuters",
    publishedAt: "2026-07-15T07:02:00Z",
    title:
      "Powell: Fed prepared to keep rates higher for longer as inflation proves sticky",
    body: "Chair Powell told the Senate panel the FOMC needs 'greater confidence' before cutting, pointing at sticky services inflation and a still-tight labor market.",
    tags: ["macro", "fed"],
  },
  {
    id: "h2",
    source: "CNBC",
    publishedAt: "2026-07-15T07:09:00Z",
    title: "Local credit union celebrates 50th anniversary with community picnic",
    body: "Members gathered for a family day featuring live music, a raffle and free financial-literacy workshops.",
    tags: ["local", "pr"],
  },
  {
    id: "h3",
    source: "Bloomberg",
    publishedAt: "2026-07-15T07:15:00Z",
    title: "US CPI runs hot at 3.8% vs 3.4% consensus; Treasury yields spike",
    body: "Core inflation re-accelerated for a second straight month, pushing two-year yields up 14bp within minutes of the print.",
    tags: ["macro", "cpi"],
  },
  {
    id: "h4",
    source: "FinancialJuice",
    publishedAt: "2026-07-15T07:21:00Z",
    title: "Celebrity chef launches meme-stock themed burger menu on Wall Street",
    body: "The pop-up will serve a 'Short Squeeze Smashburger' across the street from the NYSE through August.",
    tags: ["fluff"],
  },
  {
    id: "h5",
    source: "Dow Jones",
    publishedAt: "2026-07-15T07:28:00Z",
    title: "NVIDIA earnings smash estimates; guidance raised on data-center demand",
    body: "Q2 revenue beat consensus by 11% and management lifted full-year guidance well above the street's highest estimate.",
    tags: ["earnings", "tech"],
  },
  {
    id: "h6",
    source: "MarketWatch",
    publishedAt: "2026-07-15T07:34:00Z",
    title: "Airline unveils new long-haul cabin design with mood lighting",
    body: "The refresh focuses on premium-economy comfort, larger overhead bins and a calmer boarding flow.",
    tags: ["corporate", "pr"],
  },
  {
    id: "h7",
    source: "Reuters",
    publishedAt: "2026-07-15T07:41:00Z",
    title: "OPEC+ agrees surprise output cut; Brent crude oil jumps 4%",
    body: "The cartel trimmed quotas by 1.1m bpd, tightening an already thin physical oil market into the driving season.",
    tags: ["energy", "opec"],
  },
  {
    id: "h8",
    source: "FinancialJuice",
    publishedAt: "2026-07-15T07:47:00Z",
    title: "Op-ed: What the Fed's cafeteria menu says about central-bank culture",
    body: "A lighthearted look at institutional habits, very long lunches and the economics of subsidized soup.",
    tags: ["opinion"],
  },
  {
    id: "h9",
    source: "Bloomberg",
    publishedAt: "2026-07-15T07:53:00Z",
    title: "ECB's Lagarde hints at faster rate-cut path if disinflation holds",
    body: "Governing Council doves are pushing for a cut as early as September, sooner than markets had priced.",
    tags: ["macro", "ecb"],
  },
  {
    id: "h10",
    source: "CNBC",
    publishedAt: "2026-07-15T08:00:00Z",
    title: "Sports-betting firm signs sponsorship deal with lower-league football club",
    body: "The three-year shirt deal marks the operator's first marketing push into European sport.",
    tags: ["corporate", "pr"],
  },
  {
    id: "h11",
    source: "WSJ",
    publishedAt: "2026-07-15T08:06:00Z",
    title: "White House floats new tariffs on Chinese EVs and semiconductors",
    body: "Officials say the tariff package targets strategic sectors; automakers warn it could reignite inflation in parts and assemblies.",
    tags: ["trade", "policy"],
  },
  {
    id: "h12",
    source: "MarketWatch",
    publishedAt: "2026-07-15T08:12:00Z",
    title: "Regional bank opens flagship branch in suburban Ohio",
    body: "The branch features a coffee bar, weekend hours and a drive-through notary service.",
    tags: ["local", "pr"],
  },
  {
    id: "h13",
    source: "Reuters",
    publishedAt: "2026-07-15T08:19:00Z",
    title: "Jobless claims surge to two-year high as unemployment fears mount",
    body: "Continuing claims rose for a sixth week, hinting the labor market is finally cracking; rate-cut bets firmed after the release.",
    tags: ["macro", "labor"],
  },
  {
    id: "h14",
    source: "Dow Jones",
    publishedAt: "2026-07-15T08:25:00Z",
    title: "Shale producer's charity gala raises $2M for veterans",
    body: "Executives from across the oil patch gathered in Houston for the annual black-tie dinner.",
    tags: ["corporate", "pr"],
  },
  {
    id: "h15",
    source: "FinancialJuice",
    publishedAt: "2026-07-15T08:31:00Z",
    title: "Platform notice: scheduled maintenance Sunday 02:00–04:00 UTC",
    body: "Streaming may be briefly interrupted while we upgrade databases and edge nodes.",
    tags: ["platform"],
  },
];

export const defaultRules: FilterRules = {
  keywords: [
    "fed",
    "rate",
    "inflation",
    "cpi",
    "earnings",
    "guidance",
    "oil",
    "opec",
    "tariff",
    "unemployment",
    "ecb",
    "yields",
  ],
  muteList: ["celebrity"],
  minScore: 40,
};

export const defaultPrompt =
  "You are the sentiment engine of a trading-desk news bot. Given one financial headline, decide whether it is bullish (long), bearish (short) or neutral for the primary asset it concerns. Weigh surprise versus consensus, magnitude, and likely market positioning. Reply with a decisive call, a 0-100 confidence, and one or two sentences of reasoning a trader can skim in five seconds.";

export interface SeededSentiment {
  sentiment: Sentiment;
  confidence: number;
  reasoning: string;
}

/**
 * Deterministic sentiment per headline. Used verbatim when no API key is
 * configured (FR11 fallback, flagged in the UI) and as the base for the
 * "mock" test provider, which appends an excerpt of the active prompt so
 * prompt edits are observable without a real AI call.
 */
export const fallbackSentiments: Record<string, SeededSentiment> = {
  h1: {
    sentiment: "short",
    confidence: 74,
    reasoning:
      "Higher-for-longer guidance is a hawkish surprise against easing hopes; rate-sensitive risk assets and front-end bonds take the hit.",
  },
  h2: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Community PR item with no pricing power over any traded asset.",
  },
  h3: {
    sentiment: "short",
    confidence: 81,
    reasoning:
      "A 0.4pp upside CPI miss repriced cuts out of the curve; equities and duration both sell the print.",
  },
  h4: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Novelty story; zero read-through to positioning.",
  },
  h5: {
    sentiment: "long",
    confidence: 88,
    reasoning:
      "Double-digit beat plus raised guidance is the cleanest bullish combination; data-center demand narrative stays intact.",
  },
  h6: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Product refresh with no earnings or guidance implication.",
  },
  h7: {
    sentiment: "long",
    confidence: 77,
    reasoning:
      "Surprise supply cut into a thin market is mechanically bullish crude; watch refiner margins follow.",
  },
  h8: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Culture op-ed; entertaining, untradeable.",
  },
  h9: {
    sentiment: "long",
    confidence: 72,
    reasoning:
      "A dovish tilt sooner than priced supports EU duration and equities; euro softness is the counterweight.",
  },
  h10: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Sponsorship spend is immaterial to the operator's book.",
  },
  h11: {
    sentiment: "short",
    confidence: 63,
    reasoning:
      "Fresh tariffs raise input costs and retaliation risk for autos and semis; incrementally risk-off for the sector.",
  },
  h12: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Branch opening; no P&L consequence worth trading.",
  },
  h13: {
    sentiment: "neutral",
    confidence: 52,
    reasoning:
      "Softening labor is bad for growth but firms rate-cut bets; the two roughly cancel until the next payrolls print.",
  },
  h14: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Charity gala; goodwill only.",
  },
  h15: {
    sentiment: "neutral",
    confidence: 50,
    reasoning: "Platform maintenance notice; not market news.",
  },
};

export const genericFallback: SeededSentiment = {
  sentiment: "neutral",
  confidence: 50,
  reasoning: "No strong directional read on this item.",
};

/** Rough per-call cost of a Haiku-class sentiment read, for the savings counter. */
export const ESTIMATED_COST_PER_CALL_USD = 0.012;
