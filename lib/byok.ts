import type { ByokConfig } from "./types";

const STORAGE_KEY = "byok";

/**
 * The visitor's provider config lives ONLY in their browser's localStorage
 * and is sent per-request to the analyze route. It is never persisted or
 * logged server-side.
 */
export function loadByok(): ByokConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ByokConfig>;
    if (!parsed || !parsed.provider || !parsed.apiKey || !parsed.model) {
      return null;
    }
    return parsed as ByokConfig;
  } catch {
    return null;
  }
}

export function saveByok(config: ByokConfig): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearByok(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
