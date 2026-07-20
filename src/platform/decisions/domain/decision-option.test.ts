import {describe,it,expect} from "vitest";
import type {DecisionOption} from "./decision-option";
describe("DecisionOption",()=>{
it("supports ranked options",()=>{
const option:DecisionOption<"buy"|"wait">={
key:"buy",label:"Buy",outcome:"buy",rank:1,score:92,summary:"Best overall value"
};
expect(option.rank).toBe(1);
expect(option.score).toBe(92);
});
});