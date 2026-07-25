import type { PortfolioCompositionInput } from "../application/composition";
import { createClient } from "@/lib/supabase/server";
type PropertyRow=Readonly<{id:string;city:string|null;state:string|null;country:string|null;property_type:string|null;bedrooms:number|null}>;
type BookingRow=Readonly<{property_id:string;source:string|null;external_platform:string|null;check_in:string;total_amount:number}>;
export class SupabasePortfolioCompositionInputReader {
  async read(workspaceId:string,authorizedPropertyIds:readonly string[],period:Readonly<{from:string;to:string}>):Promise<PortfolioCompositionInput>{
    if(!authorizedPropertyIds.length)return{properties:{},bookingSources:[],seasonality:[]};
    const client=await createClient();
    const [{data:properties,error:propertyError},{data:bookings,error:bookingError}]=await Promise.all([
      client.from("properties").select("id,city,state,country,property_type,bedrooms").eq("owner_id",workspaceId).in("id",[...authorizedPropertyIds]),
      client.from("bookings").select("property_id,source,external_platform,check_in,total_amount").in("property_id",[...authorizedPropertyIds]).neq("status","cancelled").gte("check_in",period.from).lte("check_in",period.to),
    ]);
    if(propertyError)throw new Error(`Unable to read Portfolio composition property metadata: ${propertyError.message}`);
    if(bookingError)throw new Error(`Unable to read Portfolio composition booking attribution: ${bookingError.message}`);
    const rows=(bookings??[]) as BookingRow[];
    const sources=authorizedPropertyIds.flatMap((propertyId)=>[...new Set(rows.filter((row)=>row.property_id===propertyId).map((row)=>normalizeSource(row.external_platform??row.source)))].map((source)=>{
      const matching=rows.filter((row)=>row.property_id===propertyId&&normalizeSource(row.external_platform??row.source)===source);
      return{propertyId,source,bookings:matching.length,revenue:matching.reduce((sum,row)=>sum+Number(row.total_amount),0)};
    }));
    const months=[...new Set(rows.map((row)=>Number(row.check_in.slice(5,7))))].map((month)=>{
      const matching=rows.filter((row)=>Number(row.check_in.slice(5,7))===month);
      return{month,bookings:matching.length,revenue:matching.reduce((sum,row)=>sum+Number(row.total_amount),0)};
    });
    return Object.freeze({
      properties:Object.freeze(Object.fromEntries(((properties??[]) as PropertyRow[]).map((row)=>[row.id,{city:row.city,state:row.state,country:row.country,propertyType:row.property_type,bedrooms:row.bedrooms,acquisitionStrategy:null}]))),
      bookingSources:Object.freeze(sources),seasonality:Object.freeze(months),
    });
  }
}
function normalizeSource(value:string|null){if(!value)return"Unattributed";return value.replaceAll("-"," ").replace(/\b\w/g,(character)=>character.toUpperCase());}
