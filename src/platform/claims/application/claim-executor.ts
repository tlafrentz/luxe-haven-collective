import { ClaimCollection } from "../domain/claim-collection";
import { ClaimBuilder } from "./claim-builder";
import { ClaimPolicy } from "./claim-policy";

/** Coordinates Claim policies; construction remains the builder's only role. */
export class ClaimExecutor<TInput = unknown> {
  public constructor(
    private readonly policies: readonly ClaimPolicy<TInput>[],
    private readonly builder = new ClaimBuilder(),
  ) {}

  public execute(input: TInput): ClaimCollection {
    const claims = this.policies.flatMap((policy) =>
      policy.applies(input) ? policy.build(input) : []
    );

    return this.builder.build(claims);
  }
}
