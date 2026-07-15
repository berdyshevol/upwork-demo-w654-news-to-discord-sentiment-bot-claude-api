import { test, expect, type Page } from "@playwright/test";

/**
 * Behavioral acceptance tests for the Discord Sentiment Pipeline demo console.
 * One test() per PRD acceptance criterion, plus BYOK gate tests and edge cases.
 *
 * No real API key is ever used: tests seed localStorage.byok with the
 * sentinel provider "mock", which lib/llm branches on to return deterministic
 * canned sentiment (reasoning embeds an excerpt of the active prompt, so
 * prompt edits are observable).
 */

const MOCK_BYOK = JSON.stringify({
  provider: "mock",
  apiKey: "test",
  model: "mock",
});

async function seedMockByok(page: Page) {
  await page.addInitScript((value: string) => {
    window.localStorage.setItem("byok", value);
  }, MOCK_BYOK);
}

test("FR1/FR3: seeded feed shows 15 headlines with source, timestamp and a filter verdict per item", async ({
  page,
}) => {
  await page.goto("/");
  const items = page.getByTestId("feed-item");
  await expect(items).toHaveCount(15);

  // First headline: market-moving Fed item from Reuters with a HH:MM timestamp.
  const first = items.first();
  await expect(first).toContainText("Powell");
  await expect(first).toContainText("Reuters");
  await expect(first).toContainText(/\d{2}:\d{2}/);

  // All three human-readable filter verdict kinds are visible up front.
  await expect(page.getByTestId("verdict-h1")).toContainText(/passes/i);
  await expect(page.getByTestId("verdict-h2")).toContainText(/no keyword match/i);
  await expect(page.getByTestId("verdict-h4")).toContainText(/muted/i);
  await expect(page.getByTestId("verdict-h8")).toContainText(/below threshold/i);
});

test("AC1 (FR2/FR3/FR7/FR9): Start feed streams headlines through all four stages; skipped show a reason, passed produce a color-coded embed; pause/reset work", async ({
  page,
}) => {
  await seedMockByok(page);
  await page.goto("/");
  await page.getByTestId("start-feed").click();

  // Stage rows appear in the pipeline log with timestamps.
  await expect(
    page.locator('[data-testid="log-row"][data-stage="ingested"]').first()
  ).toBeVisible();
  await expect(
    page
      .locator('[data-testid="log-row"][data-stage="filtered"]')
      .filter({ hasText: /passed/ })
      .first()
  ).toBeVisible();
  await expect(
    page
      .locator('[data-testid="log-row"][data-stage="filtered"]')
      .filter({ hasText: /skipped — no keyword match/ })
      .first()
  ).toBeVisible();

  // Analyzed stage logs AI latency in ms.
  await expect(
    page
      .locator('[data-testid="log-row"][data-stage="analyzed"]')
      .filter({ hasText: /\d+ ms/ })
      .first()
  ).toBeVisible();

  // h1 (Powell higher-for-longer) is deterministically SHORT in mock mode →
  // red Discord embed (#ED4245).
  const embed = page.getByTestId("embed-h1");
  await expect(embed).toBeVisible();
  await expect(embed).toHaveAttribute("data-sentiment", "short");
  await expect(page.getByTestId("embed-bar-h1")).toHaveCSS(
    "background-color",
    "rgb(237, 66, 69)"
  );

  // Pause then reset clears the run entirely.
  await page.getByTestId("pause-feed").click();
  await page.getByTestId("reset-feed").click();
  await expect(page.locator('[data-testid="log-row"]')).toHaveCount(0);
  await expect(page.getByTestId("counter-ingested")).toHaveText("0");
});

test("AC2 (FR4): editing mute-list and min score re-filters the feed live, without a page reload", async ({
  page,
}) => {
  await page.goto("/");

  // Baseline: Powell/Fed headline passes, the oil charity gala is below threshold.
  await expect(page.getByTestId("verdict-h1")).toContainText(/passes/i);
  await expect(page.getByTestId("verdict-h14")).toContainText(/below threshold/i);

  // Lowering the min relevance score lets the single-keyword headline through.
  await page.getByTestId("minscore-input").fill("20");
  await expect(page.getByTestId("verdict-h14")).toContainText(/passes/i);

  // Adding "Fed" to the mute-list drops Fed headlines immediately.
  await page.getByTestId("mutelist-input").fill("celebrity, Fed");
  await expect(page.getByTestId("verdict-h1")).toContainText(/muted/i);
});

test("AC3 (FR5/FR6): editing the prompt and re-analyzing produces visibly different reasoning", async ({
  page,
}) => {
  await seedMockByok(page);
  await page.goto("/");

  await page.getByTestId("analyze-h1").click();
  const reasoning = page.getByTestId("embed-reasoning-h1");
  await expect(reasoning).toBeVisible();
  const before = (await reasoning.innerText()).trim();

  await page
    .getByTestId("prompt-input")
    .fill(
      "You are an aggressive intraday trader. Call the direction decisively and take a side."
    );
  await page.getByTestId("analyze-h1").click();

  await expect(reasoning).toContainText("aggressive intraday trader");
  const after = (await reasoning.innerText()).trim();
  expect(after).not.toBe(before);
});

test("AC4 (FR8/FR9): posting an embed to a Discord webhook reports success and logs the posted stage", async ({
  page,
}) => {
  await seedMockByok(page);
  // Intercept the app's own /api/discord route so the test never needs a real
  // Discord channel; UI wiring (request → success state → log row) is real.
  await page.route("**/api/discord", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );
  await page.goto("/");

  await page.getByTestId("analyze-h1").click();
  await expect(page.getByTestId("embed-h1")).toBeVisible();

  await page
    .getByTestId("webhook-input")
    .fill("https://discord.com/api/webhooks/123456789/test-token-abc");
  await page.getByTestId("post-h1").click();

  await expect(page.getByTestId("post-status-h1")).toContainText(/posted/i);
  await expect(
    page.locator('[data-testid="log-row"][data-stage="posted"]').first()
  ).toBeVisible();
});

test("AC5 (FR10): counters show ingested vs skipped vs AI calls and estimated spend avoided", async ({
  page,
}) => {
  await seedMockByok(page);
  await page.goto("/");
  await page.getByTestId("start-feed").click();

  await expect
    .poll(
      async () =>
        parseInt((await page.getByTestId("counter-ingested").innerText()) || "0", 10),
      { timeout: 30_000 }
    )
    .toBeGreaterThanOrEqual(6);

  const skipped = parseInt(
    await page.getByTestId("counter-skipped").innerText(),
    10
  );
  expect(skipped).toBeGreaterThanOrEqual(2);

  await expect
    .poll(
      async () =>
        parseInt((await page.getByTestId("counter-aicalls").innerText()) || "0", 10),
      { timeout: 30_000 }
    )
    .toBeGreaterThanOrEqual(2);

  await expect(page.getByTestId("counter-costsaved")).toContainText("$");
});

test("FR11 / BYOK gate: with no API key the hint is visible and analysis continues with a flagged fallback result", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("byok-hint")).toBeVisible();
  await expect(page.getByTestId("byok-hint")).toContainText(
    /paste your API key in Settings/i
  );

  await page.getByTestId("analyze-h1").click();
  await expect(page.getByTestId("embed-h1")).toBeVisible();
  await expect(page.getByTestId("fallback-badge-h1")).toBeVisible();
  // No key → no AI call was billed.
  await expect(page.getByTestId("counter-aicalls")).toHaveText("0");
});

test("BYOK happy path: with a saved key the hint is gone and analysis is not flagged as fallback", async ({
  page,
}) => {
  await seedMockByok(page);
  await page.goto("/");

  await expect(page.getByTestId("byok-hint")).toHaveCount(0);

  await page.getByTestId("analyze-h1").click();
  await expect(page.getByTestId("embed-h1")).toBeVisible();
  await expect(page.getByTestId("fallback-badge-h1")).toHaveCount(0);
});

test("BYOK settings: provider switch updates key label and models; save persists to localStorage.byok; clear wipes it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("open-settings").click();

  await page.getByTestId("byok-provider").selectOption("openai");
  await expect(page.getByTestId("byok-key-label")).toContainText(
    "OpenAI API key"
  );
  await expect(page.getByTestId("byok-model")).toHaveValue("gpt-4o-mini");

  await page.getByTestId("byok-key").fill("sk-test-not-a-real-key");
  await page.getByTestId("byok-save").click();

  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("byok") || "null")
  );
  expect(saved).toEqual({
    provider: "openai",
    apiKey: "sk-test-not-a-real-key",
    model: "gpt-4o-mini",
  });
  await expect(page.getByTestId("byok-hint")).toHaveCount(0);

  await page.getByTestId("open-settings").click();
  await page.getByTestId("byok-clear").click();
  const cleared = await page.evaluate(() =>
    window.localStorage.getItem("byok")
  );
  expect(cleared).toBeNull();
  await expect(page.getByTestId("byok-hint")).toBeVisible();
});

test("Edge (FR8): a non-Discord webhook URL surfaces a server-side validation error", async ({
  page,
}) => {
  await seedMockByok(page);
  await page.goto("/");

  await page.getByTestId("analyze-h1").click();
  await expect(page.getByTestId("embed-h1")).toBeVisible();

  await page
    .getByTestId("webhook-input")
    .fill("https://example.com/not-a-webhook");
  await page.getByTestId("post-h1").click();

  await expect(page.getByTestId("post-status-h1")).toContainText(
    /not a discord webhook/i
  );
});
