import { Claim } from "../domain/claim";
import { ClaimCollection } from "../domain/claim-collection";

export class ClaimBuilder {
  public build(claims: readonly Claim[]): ClaimCollection {
    return ClaimCollection.create(claims);
  }
}
