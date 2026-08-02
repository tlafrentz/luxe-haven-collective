import { describe,expect,it } from "vitest";
import { activeExpenseItems, assessExpenseDuplicate, expenseCategoryTotals, normalizeExpenseReference, type ExpenseListItem } from "./expenses";

const expense:ExpenseListItem={id:"one",propertyId:"property",propertyName:"Test",accountId:"account",name:"Platform Fees",category:"platform-fees",amountMinor:31245,currency:"USD",basis:"actual",effectiveDate:"2026-08-01",frequency:"monthly",source:"manual",sourceReference:"Statement  100",status:"recorded"};
describe("expense duplicate policy",()=>{
 it("normalizes references without weakening identity",()=>expect(normalizeExpenseReference(" Statement   100 ")).toBe("statement 100"));
 it("requires amount, date, basis, property, and reference for an exact duplicate",()=>expect(assessExpenseDuplicate({workspaceId:"workspace",propertyId:"property",basis:"actual",amountMinor:31245,effectiveDate:"2026-08-01",category:"platform-fees",frequency:"monthly",sourceReference:"statement 100"},[expense]).kind).toBe("exact"));
 it("does not reject the same amount on another date",()=>expect(assessExpenseDuplicate({workspaceId:"workspace",propertyId:"property",basis:"actual",amountMinor:31245,effectiveDate:"2026-08-02",category:"platform-fees",frequency:"monthly",sourceReference:"statement 100"},[expense]).kind).toBe("possible"));
 it("treats category and frequency similarity as advisory",()=>expect(assessExpenseDuplicate({workspaceId:"workspace",propertyId:"property",basis:"actual",amountMinor:999,effectiveDate:"2026-08-02",category:"platform-fees",frequency:"monthly"},[expense]).kind).toBe("possible"));
});
it("reconciles category totals",()=>expect(expenseCategoryTotals([expense,{...expense,id:"two",amountMinor:100}]).reduce((sum,item)=>sum+item.amountMinor,0)).toBe(31345));
it("excludes archived expenses from active calculations and duplicate checks",()=>{const archived={...expense,id:"archived",status:"archived"as const,amountMinor:99999};expect(activeExpenseItems([expense,archived])).toEqual([expense]);expect(expenseCategoryTotals([expense,archived])).toEqual([{category:"platform-fees",amountMinor:31245}]);expect(assessExpenseDuplicate({workspaceId:"workspace",propertyId:"property",basis:"actual",amountMinor:99999,effectiveDate:"2026-08-01",category:"platform-fees",frequency:"monthly",sourceReference:"Statement 100"},[archived]).kind).toBe("none")});
