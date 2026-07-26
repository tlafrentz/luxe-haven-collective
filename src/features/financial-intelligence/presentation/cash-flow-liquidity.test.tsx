import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CashFlowEmpty, CashFlowErrorView, CashFlowSkeleton } from "./cash-flow-liquidity";

describe("Cash Flow presentation states",()=>{
  it("explains the no-account empty state without claiming zero cash",()=>{const html=renderToStaticMarkup(<CashFlowEmpty/>);expect(html).toContain("Cash position unavailable");expect(html).not.toContain("$0");});
  it("announces typed failures",()=>{const html=renderToStaticMarkup(<CashFlowErrorView code="currency" message="Incompatible currencies."/>);expect(html).toContain('role="alert"');expect(html).toContain("Incompatible currencies.");});
  it("provides a reduced-motion loading skeleton",()=>{const html=renderToStaticMarkup(<CashFlowSkeleton/>);expect(html).toContain('aria-busy="true"');expect(html).toContain("motion-reduce:animate-none");});
});
