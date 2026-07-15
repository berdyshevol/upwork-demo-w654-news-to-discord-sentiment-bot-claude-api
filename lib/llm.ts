import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface ByokRequest {
  provider: string;
  apiKey: string;
  model: string;
}

/**
 * BYOK model factory. The key arrives per-request from the visitor's browser
 * (their localStorage) — there is no server-side key, no env var, and nothing
 * is logged or stored. The special provider "mock" is handled by the caller
 * before this function and never reaches a real provider.
 */
export function getModel(byok: ByokRequest): LanguageModel {
  switch (byok.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: byok.apiKey })(byok.model);
    case "openai":
      return createOpenAI({ apiKey: byok.apiKey })(byok.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: byok.apiKey })(byok.model);
    default:
      throw new Error(`Unknown provider "${byok.provider}"`);
  }
}
