import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const file=path.join(process.cwd(),"src/features/financial-intelligence/presentation/cash-flow-liquidity.tsx");
describe("cash-flow presentation boundary",()=>{it("consumes the bounded projection without repository, SQL, transfer, or runway calculations",()=>{const source=fs.readFileSync(file,"utf8");expect(source).not.toMatch(/\b(SELECT\s+\*|FROM\s+transactions|repository|matchInternalTransfers|CalculateCashRunway)\b/i);expect(source).toContain("CashFlowLiquidityView as View");expect(source).toContain("Net Cash Movement");});});
