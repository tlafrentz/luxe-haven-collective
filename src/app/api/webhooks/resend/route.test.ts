import { Buffer } from "node:buffer";
import { Webhook } from "standardwebhooks";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const upsert = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from: () => ({ upsert }) }) }));

import { POST } from "./route";

const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
const body = JSON.stringify({ type: "email.delivered", created_at: "2026-08-28T01:00:00.000Z", data: { email_id: "email_fixture_001", to: ["controlled@example.invalid"] } });

function signedRequest(payload = body, date = new Date()) {
  const id = "msg_fixture_001";
  const signature = new Webhook(secret).sign(id, date, payload);
  return new Request("https://luxehavencollective.co/api/webhooks/resend", { method: "POST", body: payload, headers: { "svix-id": id, "svix-timestamp": String(Math.floor(date.getTime()/1000)), "svix-signature": signature } });
}

describe("Resend authentication-email webhook", () => {
  beforeEach(() => { process.env.RESEND_WEBHOOK_SIGNING_SECRET = secret; rpc.mockReset().mockResolvedValue({ data: { status: "processed" }, error: null }); upsert.mockReset().mockResolvedValue({ error: null }); });

  it("accepts an officially signed Standard Webhooks fixture and passes only normalized data", async () => {
    const response = await POST(signedRequest(body, new Date()));
    expect({ status: response.status, body: await response.clone().json() }).toEqual({ status: 200, body: { accepted: true, result: { status: "processed" } } });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe("process_resend_auth_event");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_event_id: "msg_fixture_001", p_event_type: "email.delivered", p_message_id: "email_fixture_001" });
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain("controlled@example.invalid");
  });

  it("rejects an invalid signature before persistence", async () => {
    const request = signedRequest(body, new Date());
    request.headers.set("svix-signature", "v1,invalid");
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("rejects stale delivery before provider verification", async () => {
    const response = await POST(signedRequest(body, new Date(Date.now()-301_000)));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
