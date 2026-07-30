import type { CanonicalPropertyProvider } from "../../application/lookup-subject-property";
import type { PropertyLookupCandidate } from "../../domain/subject-property";
import { RealtyApiClient } from "./client";
import { normalizeRealtyApiError } from "./errors";
import { mapRealtyApiCandidates, mapRealtyApiProperty } from "./mapper";

export class RealtyApiPropertyProvider implements CanonicalPropertyProvider {
  constructor(private readonly client: RealtyApiClient) {}

  async search(address: string): Promise<readonly PropertyLookupCandidate[]> {
    try {
      return mapRealtyApiCandidates(await this.client.autocomplete(address));
    } catch (error) {
      throw normalizeRealtyApiError(error);
    }
  }

  async retrieve(
    candidate: PropertyLookupCandidate,
    context: Parameters<CanonicalPropertyProvider["retrieve"]>[1],
  ): ReturnType<CanonicalPropertyProvider["retrieve"]> {
    try {
      const response = await this.client.getDetailsById(candidate.providerPropertyId, candidate.listingId);
      return mapRealtyApiProperty(response, candidate, context);
    } catch (error) {
      throw normalizeRealtyApiError(error);
    }
  }
}

export function createRealtyApiPropertyProvider(options: ConstructorParameters<typeof RealtyApiClient>[0]): RealtyApiPropertyProvider {
  return new RealtyApiPropertyProvider(new RealtyApiClient(options));
}
