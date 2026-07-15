export type Sentiment = "long" | "short" | "neutral";

export type AnalysisMode = "live" | "mock" | "fallback";

export interface Headline {
  id: string;
  source: string;
  publishedAt: string;
  title: string;
  body: string;
  tags: string[];
}

export interface FilterRules {
  keywords: string[];
  muteList: string[];
  minScore: number;
}

export interface Verdict {
  passed: boolean;
  score: number;
  matched: string[];
  reason: string;
}

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  reasoning: string;
  mode: AnalysisMode;
  isFallback: boolean;
  latencyMs: number;
}

export type Stage = "ingested" | "filtered" | "analyzed" | "posted";

export interface LogRow {
  id: number;
  headlineId: string;
  headlineTitle: string;
  stage: Stage;
  at: string;
  note?: string;
}

export interface ByokConfig {
  provider: "anthropic" | "openai" | "google" | "mock";
  apiKey: string;
  model: string;
}
