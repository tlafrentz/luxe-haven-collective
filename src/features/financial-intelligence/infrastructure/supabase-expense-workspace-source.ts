import { createClient } from "@/lib/supabase/server";
import { isFinancialExpenseCategory, type ExpenseWorkspace, type FinancialExpenseBasis, type FinancialExpenseFrequency } from "../application";

type Row={id:string;account_id:string;property_id:string;amount_minor:number;currency:string;measurement:FinancialExpenseBasis;effective_date:string;effective_to:string|null;frequency:FinancialExpenseFrequency;source_provider:string;source_external_id:string|null;status:"pending"|"posted"|"voided";archived_at:string|null;archived_by_profile_id:string|null;financial_accounts:{name:string;subcategory:string|null}|null;properties:{name:string}|null};
export class SupabaseExpenseWorkspaceSource{
  async read(input:{workspaceId:string;propertyIds:readonly string[];from:string;to:string;basis:FinancialExpenseBasis}):Promise<ExpenseWorkspace>{
    const client=await createClient();
    const [transactions,properties]=await Promise.all([
      input.propertyIds.length?client.from("financial_transactions").select("id,account_id,property_id,amount_minor,currency,measurement,effective_date,effective_to,frequency,source_provider,source_external_id,status,archived_at,archived_by_profile_id,financial_accounts(name,subcategory),properties(name)").eq("workspace_id",input.workspaceId).in("property_id",[...input.propertyIds]).eq("measurement",input.basis).gte("effective_date",input.from).lte("effective_date",input.to).order("effective_date",{ascending:false}):Promise.resolve({data:[],error:null}),
      client.from("properties").select("id,name").eq("owner_id",input.workspaceId).in("id",[...input.propertyIds]).neq("status","archived").order("name")
    ]);
    if(transactions.error||properties.error)throw new Error(`Unable to read operating expenses: ${transactions.error?.message??properties.error?.message}`);
    const expenses=((transactions.data??[])as unknown as Row[]).flatMap(row=>{
      const category=row.financial_accounts?.subcategory??"operations";
      if(!isFinancialExpenseCategory(category))return[];
      return[{id:row.id,propertyId:row.property_id,propertyName:row.properties?.name??"Property",accountId:row.account_id,name:row.financial_accounts?.name??category.replaceAll("-"," "),category,amountMinor:Number(row.amount_minor),currency:row.currency,basis:row.measurement,effectiveDate:row.effective_date,effectiveTo:row.effective_to??undefined,frequency:row.frequency,source:row.source_provider,sourceReference:row.source_external_id??undefined,status:row.status==="posted"?"recorded"as const:row.status==="voided"?"archived"as const:"pending"as const,archivedAt:row.archived_at??undefined,archivedBy:row.archived_by_profile_id??undefined}];
    });
    return Object.freeze({expenses:Object.freeze(expenses),properties:Object.freeze((properties.data??[]).map(item=>({id:String(item.id),name:String(item.name)})))});
  }
}
