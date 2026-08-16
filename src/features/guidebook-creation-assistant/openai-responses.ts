import { z } from "zod";

export const nanoSmokeResultSchema = z.object({ ok: z.boolean() }).strict();
export const nanoSmokeJsonSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({ ok: Object.freeze({ type: "boolean" }) }),
  required: Object.freeze(["ok"]),
  additionalProperties: false,
});

export type StructuredResponseOutcome = "completed_valid" | "completed_invalid" | "incomplete" | "refusal" | "provider_failure";
export type StructuredResponseDiagnostic = Readonly<{
  outcome: StructuredResponseOutcome;
  httpStatus: number;
  openaiRequestId: string | null;
  responseStatus: "completed" | "incomplete" | "failed";
  returnedModel: string | null;
  outputItemTypes: readonly string[];
  outputTextExisted: boolean;
  refusalExisted: boolean;
  incompleteReason: string | null;
  usageExisted: boolean;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  calculatedCostUsd: number;
  latencyMs: number;
  correlationId: string;
  jsonParseResult: "valid" | "malformed" | "not_attempted";
  schemaValidationErrors: readonly Readonly<{ path: string; expected: string }> [];
  classification: string;
}>;

export function diagnoseNanoStructuredResponse(input: Readonly<{ body: unknown; httpStatus: number; openaiRequestId: string | null; latencyMs: number; correlationId: string }>): StructuredResponseDiagnostic {
  const body = input.body && typeof input.body === "object" ? input.body as Record<string, unknown> : {};
  const status = body.status === "incomplete" || body.status === "failed" ? body.status : "completed";
  const output = Array.isArray(body.output) ? body.output.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const outputItemTypes = output.map(item => typeof item.type === "string" ? item.type : "unknown");
  const content = output.flatMap(item => Array.isArray(item.content) ? item.content.filter((part): part is Record<string, unknown> => Boolean(part) && typeof part === "object") : []);
  const textPart = content.find(part => part.type === "output_text" && typeof part.text === "string");
  const outputText = typeof body.output_text === "string" ? body.output_text : typeof textPart?.text === "string" ? textPart.text : null;
  const refusalExisted = content.some(part => part.type === "refusal" || typeof part.refusal === "string");
  const incomplete = body.incomplete_details && typeof body.incomplete_details === "object" ? body.incomplete_details as Record<string, unknown> : {};
  const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : null;
  const inputDetail = usage?.input_tokens_details && typeof usage.input_tokens_details === "object" ? usage.input_tokens_details as Record<string, unknown> : {};
  const outputDetail = usage?.output_tokens_details && typeof usage.output_tokens_details === "object" ? usage.output_tokens_details as Record<string, unknown> : {};
  const inputTokens = finite(usage?.input_tokens), cachedInputTokens = finite(inputDetail.cached_tokens), outputTokens = finite(usage?.output_tokens), reasoningTokens = finite(outputDetail.reasoning_tokens);
  const base = {
    httpStatus: input.httpStatus, openaiRequestId: input.openaiRequestId, responseStatus: status,
    returnedModel: typeof body.model === "string" ? body.model : null, outputItemTypes: Object.freeze(outputItemTypes),
    outputTextExisted: outputText !== null, refusalExisted, incompleteReason: typeof incomplete.reason === "string" ? incomplete.reason : null,
    usageExisted: usage !== null, inputTokens, cachedInputTokens, outputTokens, reasoningTokens,
    calculatedCostUsd: Number((((inputTokens-cachedInputTokens)*.05+cachedInputTokens*.005+outputTokens*.4)/1_000_000).toFixed(8)),
    latencyMs: Math.max(0, Math.round(input.latencyMs)), correlationId: input.correlationId,
  } as const;
  if (!input.httpStatus || input.httpStatus < 200 || input.httpStatus >= 300 || status === "failed") return Object.freeze({ ...base, outcome: "provider_failure", jsonParseResult: "not_attempted", schemaValidationErrors: Object.freeze([]), classification: safeHttpClassification(input.httpStatus) });
  if (status === "incomplete") return Object.freeze({ ...base, outcome: "incomplete", jsonParseResult: "not_attempted", schemaValidationErrors: Object.freeze([]), classification: "OPENAI_RESPONSE_INCOMPLETE" });
  if (refusalExisted) return Object.freeze({ ...base, outcome: "refusal", jsonParseResult: "not_attempted", schemaValidationErrors: Object.freeze([]), classification: "OPENAI_RESPONSE_REFUSED" });
  if (outputText === null) return Object.freeze({ ...base, outcome: "completed_invalid", jsonParseResult: "not_attempted", schemaValidationErrors: Object.freeze([{ path: "$.output", expected: "message content containing output_text" }]), classification: "OPENAI_OUTPUT_TEXT_MISSING" });
  let parsed: unknown;
  try { parsed = JSON.parse(outputText); } catch { return Object.freeze({ ...base, outcome: "completed_invalid", jsonParseResult: "malformed", schemaValidationErrors: Object.freeze([{ path: "$", expected: "valid JSON object" }]), classification: "OPENAI_MALFORMED_JSON" }); }
  const validated = nanoSmokeResultSchema.safeParse(parsed);
  if (!validated.success) return Object.freeze({ ...base, outcome: "completed_invalid", jsonParseResult: "valid", schemaValidationErrors: Object.freeze(validated.error.issues.map(issue => Object.freeze({ path: issue.path.length ? `$.${issue.path.join(".")}` : "$", expected: expectedType(issue) }))), classification: "OPENAI_SCHEMA_MISMATCH" });
  return Object.freeze({ ...base, outcome: "completed_valid", jsonParseResult: "valid", schemaValidationErrors: Object.freeze([]), classification: "OPENAI_NANO_GENERATION_SMOKE_SUCCEEDED" });
}

function expectedType(issue: z.core.$ZodIssue) { return "expected" in issue && typeof issue.expected === "string" ? issue.expected : issue.code === "unrecognized_keys" ? "no additional properties" : issue.code; }
function finite(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function safeHttpClassification(status: number) { if(status===401||status===403)return"OPENAI_AUTHORIZATION_FAILED";if(status===404)return"OPENAI_MODEL_UNAVAILABLE";if(status===429)return"OPENAI_RATE_LIMITED";return status>=500?"OPENAI_UNAVAILABLE":"OPENAI_PROVIDER_FAILED"; }
