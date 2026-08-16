import { randomUUID } from "node:crypto";

async function main() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY_REQUIRED");

  const model = "gpt-5.4-nano";
  const started = performance.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    "x-client-request-id": randomUUID(),
  },
  body: JSON.stringify({
    model,
    store: false,
    input: "Return a JSON object with one boolean field named ok.",
    text: { format: { type: "json_object" } },
    reasoning: { effort: "low" },
    max_output_tokens: 40,
  }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const usage = body.usage && typeof body.usage === "object"
    ? body.usage as Record<string, unknown>
    : {};
  const inputTokens = finite(usage.input_tokens);
  const outputTokens = finite(usage.output_tokens);
  const totalTokens = finite(usage.total_tokens);
  const calculatedCostUsd = Number(((inputTokens * 0.2 + outputTokens * 1.25) / 1_000_000).toFixed(8));

  process.stdout.write(JSON.stringify({
    ok: response.ok,
    status: response.status,
    model: typeof body.model === "string" ? body.model : model,
    stage: "authentication",
    providerRequestId: typeof body.id === "string" ? body.id : response.headers.get("x-request-id"),
    inputTokens,
    outputTokens,
    totalTokens,
    latencyMs: Math.max(0, Math.round(performance.now() - started)),
    calculatedCostUsd,
  }));
  if (!response.ok) process.exitCode = 1;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

main().catch(() => {
  process.stderr.write("OPENAI_AUTH_VERIFICATION_FAILED\n");
  process.exitCode = 1;
});
