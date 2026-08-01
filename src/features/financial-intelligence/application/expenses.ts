import { financialExpenseCategories, type FinancialExpenseCategory } from "../domain";

export const financialExpenseFrequencies = ["one-time", "nightly", "weekly", "monthly", "quarterly", "annual"] as const;
export type FinancialExpenseFrequency = typeof financialExpenseFrequencies[number];
export type FinancialExpenseBasis = "actual" | "forecast" | "scenario" | "budget" | "target";

export type ExpenseListItem = Readonly<{
  id: string; propertyId: string; propertyName: string; accountId: string; name: string;
  category: FinancialExpenseCategory; amountMinor: number; currency: string; basis: FinancialExpenseBasis;
  effectiveDate: string; effectiveTo?: string; frequency: FinancialExpenseFrequency;
  source: string; sourceReference?: string; status: "pending" | "recorded" | "archived";
}>;
export type ExpenseWorkspace = Readonly<{ expenses: readonly ExpenseListItem[]; properties: readonly Readonly<{id:string;name:string}>[] }>;
export type SimilarExpense = Pick<ExpenseListItem,"id"|"name"|"category"|"amountMinor"|"currency"|"effectiveDate"|"source"|"sourceReference">;
export type DuplicateAssessment = {kind:"none"}|{kind:"possible";matches:readonly SimilarExpense[]}|{kind:"exact";matches:readonly SimilarExpense[]};

export type DuplicateCandidate = Readonly<{workspaceId:string;propertyId:string;basis:FinancialExpenseBasis;amountMinor:number;effectiveDate:string;category:FinancialExpenseCategory;frequency:FinancialExpenseFrequency;sourceReference?:string}>;
export function normalizeExpenseReference(value?:string){return value?.trim().toLocaleLowerCase("en-US").replace(/\s+/g," ")||undefined;}
export function assessExpenseDuplicate(candidate:DuplicateCandidate,expenses:readonly (ExpenseListItem&{workspaceId?:string})[]):DuplicateAssessment{
  const scoped=expenses.filter(item=>item.propertyId===candidate.propertyId&&item.basis===candidate.basis);
  const reference=normalizeExpenseReference(candidate.sourceReference);
  const exact=scoped.filter(item=>item.amountMinor===candidate.amountMinor&&item.effectiveDate===candidate.effectiveDate&&reference!==undefined&&normalizeExpenseReference(item.sourceReference)===reference);
  if(exact.length)return{kind:"exact",matches:exact};
  const possible=scoped.filter(item=>item.amountMinor===candidate.amountMinor||item.category===candidate.category||normalizeExpenseReference(item.sourceReference)===reference).slice(0,5);
  return possible.length?{kind:"possible",matches:possible}:{kind:"none"};
}

export function expenseCategoryTotals(expenses:readonly ExpenseListItem[]){
  const totals=new Map<FinancialExpenseCategory,number>();
  for(const expense of expenses)totals.set(expense.category,(totals.get(expense.category)??0)+expense.amountMinor);
  return [...totals].map(([category,amountMinor])=>({category,amountMinor})).sort((a,b)=>b.amountMinor-a.amountMinor);
}
export function isFinancialExpenseCategory(value:string):value is FinancialExpenseCategory{return (financialExpenseCategories as readonly string[]).includes(value);}
