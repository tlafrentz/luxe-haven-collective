import { describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import { createCommerceOrder, createCommercePrice, createCommerceProduct, getCommerceCatalog, InMemoryCommerceCatalogRepository, resolveProductEligibility } from ".";
const now=new Date("2026-07-25T00:00:00Z");
const product=createCommerceProduct({id:"p1",slug:"analysis",name:"Analysis",shortDescription:"Short",longDescription:"Long",categoryId:"investment",type:"professional-service",fulfillmentType:"analysis-credit",status:"active",entitlementTemplateIds:["investment.analysis.create"],createdAt:now,updatedAt:now});
const price=createCommercePrice({id:"price1",productId:"p1",type:"one-time",amount:Money.usd(199),status:"active",createdAt:now});
describe("Commerce foundation",()=>{
 it("separates immutable product identity from versioned price",()=>{expect(product).not.toHaveProperty("amount");expect(price.version).toBe(1);expect(Object.isFrozen(product)).toBe(true)});
 it("preserves product and price snapshots on pending orders",()=>{const order=createCommerceOrder({id:"o1",orderNumber:"LHC-1",customerId:"c1",currency:"USD",lines:[{id:"l1",product,price,quantity:2}],createdAt:now});expect(order.total.amount).toBe(398);expect(order.lines[0].productSnapshot.name).toBe("Analysis");expect(order.lines[0].priceSnapshot.amount.minorUnits).toBe(19900);expect(Object.isFrozen(order.lines[0])).toBe(true)});
 it("resolves configuration-driven eligibility",()=>{expect(resolveProductEligibility({id:"owner",audience:"owner",active:true},{authenticated:true,owner:false,admin:false}).eligible).toBe(false);expect(resolveProductEligibility({id:"owner",audience:"owner",active:true},{authenticated:true,owner:true,admin:false}).eligible).toBe(true)});
 it("projects only active catalog products and prices",async()=>{const catalog=await getCommerceCatalog(new InMemoryCommerceCatalogRepository([product],[price],[]));expect(catalog.products).toHaveLength(1);expect(catalog.products[0].prices[0].id).toBe("price1")});
 it("requires recurring intervals and compatible order lines",()=>{expect(()=>createCommercePrice({...price,id:"monthly",type:"monthly",interval:undefined})).toThrow("Recurring prices require");expect(()=>createCommerceOrder({id:"o",orderNumber:"N",customerId:"c",currency:"USD",lines:[],createdAt:now})).toThrow("at least one line")});
});
