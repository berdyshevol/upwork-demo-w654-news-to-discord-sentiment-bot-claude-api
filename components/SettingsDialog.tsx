"use client";

import { useEffect, useState } from "react";
import type { ByokConfig } from "@/lib/types";

const PROVIDERS = {
  anthropic: {
    label: "Anthropic",
    keyLabel: "Anthropic API key",
    models: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
  },
  openai: {
    label: "OpenAI",
    keyLabel: "OpenAI API key",
    models: ["gpt-4o-mini", "gpt-4o", "o1-mini"],
  },
  google: {
    label: "Google",
    keyLabel: "Google API key",
    models: ["gemini-2.0-flash", "gemini-2.5-pro"],
  },
} as const;

type ProviderId = keyof typeof PROVIDERS;

interface Props {
  open: boolean;
  current: ByokConfig | null;
  onSave: (config: ByokConfig) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function SettingsDialog({
  open,
  current,
  onSave,
  onClear,
  onClose,
}: Props) {
  const initialProvider: ProviderId =
    current && current.provider in PROVIDERS
      ? (current.provider as ProviderId)
      : "anthropic";
  const [provider, setProvider] = useState<ProviderId>(initialProvider);
  const [apiKey, setApiKey] = useState(current?.apiKey ?? "");
  const [model, setModel] = useState(
    current && current.provider in PROVIDERS
      ? current.model
      : PROVIDERS.anthropic.models[0]
  );

  useEffect(() => {
    if (open) {
      const p: ProviderId =
        current && current.provider in PROVIDERS
          ? (current.provider as ProviderId)
          : "anthropic";
      setProvider(p);
      setApiKey(current?.apiKey ?? "");
      setModel(
        current && current.provider in PROVIDERS
          ? current.model
          : PROVIDERS[p].models[0]
      );
    }
  }, [open, current]);

  if (!open) return null;

  const info = PROVIDERS[provider];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-md bg-zinc-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-zinc-100">
          AI provider settings (BYOK)
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-zinc-400">
          Your key stays in this browser&apos;s localStorage and is sent only
          with your own analyze requests — it is never stored or logged by this
          demo. Without a key the pipeline runs on seeded fallback sentiments.
        </p>

        <label className="field-label" htmlFor="byok-provider">
          Provider
        </label>
        <select
          id="byok-provider"
          data-testid="byok-provider"
          className="field-input mb-3"
          value={provider}
          onChange={(e) => {
            const p = e.target.value as ProviderId;
            setProvider(p);
            setModel(PROVIDERS[p].models[0]);
          }}
        >
          {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>

        <label
          className="field-label"
          htmlFor="byok-key"
          data-testid="byok-key-label"
        >
          {info.keyLabel}
        </label>
        <input
          id="byok-key"
          data-testid="byok-key"
          type="password"
          className="field-input mb-3"
          placeholder={
            provider === "anthropic"
              ? "sk-ant-…"
              : provider === "openai"
                ? "sk-…"
                : "AIza…"
          }
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        <label className="field-label" htmlFor="byok-model">
          Model
        </label>
        <select
          id="byok-model"
          data-testid="byok-model"
          className="field-input mb-5"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {info.models.map((m, i) => (
            <option key={m} value={m}>
              {m}
              {i === 0 ? " (default)" : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between">
          <button
            data-testid="byok-clear"
            className="btn-secondary text-red-400"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Clear key
          </button>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              data-testid="byok-save"
              className="btn-primary"
              disabled={!apiKey.trim()}
              onClick={() => {
                onSave({ provider, apiKey: apiKey.trim(), model });
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
