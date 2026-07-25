import {
  buildPortfolioProjection,
  type BuildPortfolioProjectionQuery,
  type PortfolioProjectionSource,
  type PortfolioReadRepository,
} from "../application/read-model";

/**
 * A read-through adapter. Portfolio remains a projection over authoritative
 * workspace sources; this repository does not persist a second portfolio copy.
 */
export class ComputedPortfolioRepository implements PortfolioReadRepository {
  constructor(private readonly source: PortfolioProjectionSource) {}

  buildPortfolioProjection(query: BuildPortfolioProjectionQuery) {
    return buildPortfolioProjection(this.source, query);
  }

  getPortfolioProjection(query: BuildPortfolioProjectionQuery) {
    return this.buildPortfolioProjection(query);
  }
}
