import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const RequestSchema = z.object({
  webhookUrl: z.string().min(1),
  embed: z.object({
    title: z.string(),
    description: z.string(),
    color: z.number(),
    fields: z.array(
      z.object({ name: z.string(), value: z.string(), inline: z.boolean() })
    ),
    footer: z.object({ text: z.string() }),
    timestamp: z.string(),
  }),
});

/** Only genuine Discord webhook endpoints are ever contacted (no open proxy). */
function isDiscordWebhook(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      /(^|\.)discord(app)?\.com$/.test(url.hostname) &&
      url.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request: webhookUrl and embed are required" },
      { status: 400 }
    );
  }

  const { webhookUrl, embed } = parsed;

  if (!isDiscordWebhook(webhookUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Not a Discord webhook URL (expected https://discord.com/api/webhooks/…)",
      },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Sentiment Pipeline",
        embeds: [embed],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return NextResponse.json({ ok: true });
    }
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return NextResponse.json(
      {
        ok: false,
        error: `Discord responded ${res.status}${detail ? `: ${detail}` : ""}`,
      },
      { status: 502 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach Discord (network error or timeout)" },
      { status: 502 }
    );
  }
}
