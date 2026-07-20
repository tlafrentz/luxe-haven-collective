import { Claim } from "../domain/claim";

export interface ClaimPolicy<TInput=unknown>{
  readonly name:string;
  readonly capability:string;
  applies(input:TInput):boolean;
  build(input:TInput):readonly Claim[];
}
