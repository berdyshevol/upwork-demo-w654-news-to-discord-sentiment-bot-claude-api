import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/llm";
import { fallbackSentiments, genericFallback } from "@/lib/seed";

export const runtime = "nodejs";

const RequestSchema = z.object({
  headlineId: z.string(),
  title: z.string().min(1),
  body: z.string(),
  source: z.string(),
  prompt: z.string().min(1),
  byok: z
    .object({
      provider: z.string(),
      apiKey: z.string(),
      model: z.string(),
    })
    .nullable()
    .optional(),
});

const SentimentSchema = z.object({
  sentiment: z.enum(["long", "short", "neutral"]),
  confidence: z.number().min(0).max(100),
  reasoning: z
    .string()
    .describe("One or two sentences a trader can skim in five seconds"),
});

function seededFor(headlineId: string) {
  return fallbackSentiments[headlineId] ?? genericFallback;
}

/**
 * Sentiment stage of the pipeline. BYOK: the visitor's provider config is
 * read from the request body only — never from env vars, never logged,
 * never stored. Without a key (or on provider error) the route degrades to
 * the seeded fallback so the demo pipeline never stalls (FR11).
 */
export async function POST(req: Request) {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid analyze request" },
      { status: 400 }
    );
  }

  const { headlineId, title, body, source, prompt, byok } = parsed;

  if (!byok || !byok.apiKey) {
    return NextResponse.json({ ...seededFor(headlineId), mode: "fallback" });
  }

  // Test/demo sentinel provider: deterministic result, no network. The
  // reasoning embeds an excerpt of the active prompt so prompt edits are
  // visible in the output without a real AI call.
  if (byok.provider === "mock") {
    const base = seededFor(headlineId);
    const lens = prompt.replace(/\s+/g, " ").trim().slice(0, 80);
    return NextResponse.json({
      sentiment: base.sentiment,
      confidence: base.confidence,
      reasoning: `${base.reasoning} [prompt lens: "${lens}"]`,
      mode: "mock",
    });
  }

  try {
    const { object } = await generateObject({
      model: getModel(byok),
      schema: SentimentSchema,
      system: prompt,
      prompt: `Source: ${source}\nHeadline: ${title}\nDetails: ${body}\n\nClassify this single headline.`,
    });
    return NextResponse.json({ ...object, mode: "live" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider call failed";
    return NextResponse.json({
      ...seededFor(headlineId),
      mode: "fallback",
      error: message.slice(0, 200),
    });
  }
}
