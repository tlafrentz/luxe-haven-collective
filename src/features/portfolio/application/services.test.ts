import { describe, expect, it } from "vitest";

import { PortfolioGoal, PortfolioStrategy } from "../domain";
import { InMemoryPortfolioRepository } from "../infrastructure";
import { createPortfolio, loadPortfolio, savePortfolio } from "./services";

const strategy = {
  strategy: PortfolioStrategy.create("growth"),
  goals: [PortfolioGoal.create("scale", "Grow to ten operating properties.")],
};

describe("Portfolio application services", () => {
  it("creates, owner-scopes, loads, and version-saves an aggregate", async () => {
    const repository = new InMemoryPortfolioRepository();
    const portfolio = await createPortfolio(repository, { authenticatedOwnerId: "owner-1", name: "Growth Portfolio", strategy });
    expect(await loadPortfolio(repository, portfolio.id, "owner-2")).toBeNull();
    const loaded = await loadPortfolio(repository, portfolio.id, "owner-1");
    expect(loaded?.props.name.value).toBe("Growth Portfolio");
    loaded!.addOpportunity("opportunity-1", "observed", new Date());
    await savePortfolio(repository, { portfolio: loaded!, authenticatedOwnerId: "owner-1", expectedVersion: 1 });
    expect((await loadPortfolio(repository, portfolio.id, "owner-1"))?.version).toBe(2);
  });

  it("rejects ownership overrides and stale writes", async () => {
    const repository = new InMemoryPortfolioRepository();
    await expect(createPortfolio(repository, { authenticatedOwnerId: "owner-1", ownerId: "owner-2", name: "Wrong", strategy })).rejects.toMatchObject({ code: "PORTFOLIO_ACCESS_DENIED" });
    const portfolio = await createPortfolio(repository, { authenticatedOwnerId: "owner-1", name: "Portfolio", strategy });
    portfolio.addOpportunity("opportunity-1", "observed", new Date());
    await expect(savePortfolio(repository, { portfolio, authenticatedOwnerId: "owner-1", expectedVersion: 2 })).rejects.toMatchObject({ code: "PORTFOLIO_VERSION_CONFLICT" });
  });
});
