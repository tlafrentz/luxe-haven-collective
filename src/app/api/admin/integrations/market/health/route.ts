import { getSessionProfile } from "@/lib/auth/session";
import { getMarketIntelligenceConfig, MarketIntelligenceConfigurationError } from "@/features/market-intelligence/infrastructure/market-intelligence-config";
import { getInvestmentWorkspaceHealth } from "@/app/actions/investment-workspace-runtime";

export const runtime = "nodejs";

export async function GET() {
  const { user, profile } = await getSessionProfile();
  if (!user) return Response.json({ ok: false, code: "unauthenticated" }, { status: 401 });
  if (profile?.role !== "admin") return Response.json({ ok: false, code: "forbidden" }, { status: 403 });
  try {
    const config = getMarketIntelligenceConfig();
    return Response.json({
      ok: true,
      provider: { enabled: config.providerEnabled, configured: !config.providerEnabled || Boolean(config.rentCastApiKey), timeoutMs: config.requestTimeoutMs },
      policyVersion: "market-analysis-v1",
      operations: config.providerEnabled ? getInvestmentWorkspaceHealth() : { ...getInvestmentWorkspaceHealth(), status: "disabled" },
    });
  } catch (error) {
    return Response.json({ ok: false, status: "misconfigured", code: error instanceof MarketIntelligenceConfigurationError ? "invalid-market-configuration" : "unknown" }, { status: 503 });
  }
}
