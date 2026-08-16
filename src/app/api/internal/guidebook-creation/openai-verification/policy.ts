import { createHash } from "node:crypto";

export const OPENAI_NANO_SMOKE_V1_OPERATION = "openai_nano_generation_smoke_v1";
export const OPENAI_NANO_SMOKE_V1_IDEMPOTENCY_HASH = createHash("sha256")
  .update(`guidebook:openai:verification:${OPENAI_NANO_SMOKE_V1_OPERATION}`)
  .digest("hex");
export const OPENAI_NANO_SMOKE_OPERATION = "openai_nano_generation_smoke_v2";
export const OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH = createHash("sha256")
  .update(`guidebook:openai:verification:${OPENAI_NANO_SMOKE_OPERATION}`)
  .digest("hex");
