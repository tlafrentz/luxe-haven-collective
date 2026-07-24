import "server-only";
import { createPortfolioId } from "@/features/portfolio";
import {
  createGetPortfolioIntelligenceDashboard,
  type GetPortfolioIntelligenceDashboardQuery,
  type PortfolioDashboardReader,
} from "@/features/portfolio-intelligence";
import { getSessionProfile } from "@/lib/auth/session";

const unavailableReader: PortfolioDashboardReader = Object.freeze({
  async read() {
    // PI-006 introduces no migration. Production deployments provide the
    // canonical PI-001/002/003/005 readers through the dashboard composition.
    throw new Error("Portfolio dashboard storage adapters are not configured.");
  },
});

export async function getPortfolioDashboardRouteState(input: Readonly<{
  portfolioId: string;
  start: Date;
  end: Date;
  evaluatedAt: Date;
}>) {
  const { user } = await getSessionProfile();
  if (!user) return { ok: false as const, code: "PORTFOLIO_DASHBOARD_NOT_AUTHENTICATED" as const };
  let portfolioId;
  try {
    portfolioId = createPortfolioId(input.portfolioId);
  } catch {
    return { ok: false as const, code: "PORTFOLIO_DASHBOARD_INPUT_INVALID" as const };
  }
  const query: GetPortfolioIntelligenceDashboardQuery = Object.freeze({
    ownerId: user.id,
    portfolioId,
    observationWindow: Object.freeze({ start: input.start, end: input.end }),
    evaluatedAt: input.evaluatedAt,
  });
  const execute = createGetPortfolioIntelligenceDashboard({
    authorizer: Object.freeze({ async authorize(ownerId: string) { return ownerId === user.id ? "authorized" as const : "concealed" as const; } }),
    reader: unavailableReader,
  });
  const result = await execute(query);
  return result.isSuccess ? { ok: true as const, state: result.value } : { ok: false as const, code: result.error.code };
}
