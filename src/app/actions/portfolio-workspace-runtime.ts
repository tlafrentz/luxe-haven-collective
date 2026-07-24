import "server-only";
import { createPortfolioId } from "@/features/portfolio";
import {
  createGetPortfolioIntelligenceWorkspace,
  type GetPortfolioIntelligenceWorkspaceQuery,
  type PortfolioWorkspaceReader,
} from "@/features/portfolio-intelligence";
import { getSessionProfile } from "@/lib/auth/session";

const unavailableReader: PortfolioWorkspaceReader = Object.freeze({
  async read() {
    // PI-004 defines the production boundary without introducing a persistence
    // migration. Deployments provide the PI-001 repository and immutable
    // assessment readers through composePortfolioWorkspaceProduction.
    throw new Error("Portfolio workspace storage adapter is not configured.");
  },
});

export async function getPortfolioWorkspaceRouteState(input: Readonly<{
  portfolioId: string;
  start: Date;
  end: Date;
  evaluatedAt: Date;
}>) {
  const { user } = await getSessionProfile();
  if (!user) return { ok: false as const, code: "PORTFOLIO_WORKSPACE_NOT_AUTHENTICATED" as const };
  let portfolioId;
  try {
    portfolioId = createPortfolioId(input.portfolioId);
  } catch {
    return { ok: false as const, code: "PORTFOLIO_WORKSPACE_INPUT_INVALID" as const };
  }
  const query: GetPortfolioIntelligenceWorkspaceQuery = Object.freeze({
    ownerId: user.id,
    portfolioId,
    observationWindow: Object.freeze({ start: input.start, end: input.end }),
    evaluatedAt: input.evaluatedAt,
  });
  const execute = createGetPortfolioIntelligenceWorkspace({
    authorizer: Object.freeze({
      async authorize(ownerId: string) {
        return ownerId === user.id ? "authorized" as const : "concealed" as const;
      },
    }),
    reader: unavailableReader,
  });
  const result = await execute(query);
  return result.isSuccess
    ? { ok: true as const, state: result.value }
    : { ok: false as const, code: result.error.code };
}
