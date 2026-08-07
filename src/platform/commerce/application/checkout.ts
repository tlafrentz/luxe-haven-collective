import { createCommerceOrder, type CommerceCustomer, type CommerceOrder } from "../domain";
import type { CommerceCatalogRepository, CommerceOrderRepository } from "./catalog";

export type CommerceEnvironment = "test" | "live";
export type ProviderCustomer = Readonly<{ id: string; email: string }>;
export type ProviderCheckout = Readonly<{ id: string; url?: string; status: "open" | "complete" | "expired"; expiresAt: Date; environment: CommerceEnvironment }>;
export type CommerceCheckoutAddOn = Readonly<{ name: string; amountMinor: number; currency: string }>;
export interface CommerceProvider {
  resolveCustomer(input: Readonly<{ commerceCustomerId: string; email: string; existingProviderCustomerId?: string; idempotencyKey: string }>): Promise<ProviderCustomer>;
  createCheckoutSession(input: Readonly<{ mode: "payment" | "subscription"; providerCustomerId: string; providerPriceId: string; quantity: number; successUrl: string; cancelUrl: string; metadata: Readonly<Record<string,string>>; idempotencyKey: string; addOn?: CommerceCheckoutAddOn }>): Promise<ProviderCheckout>;
  getCheckout(id: string): Promise<ProviderCheckout>;
}
export interface CommerceCustomerStore {
  findByIdentity(input: Readonly<{ profileId?: string; workspaceId?: string; email: string }>): Promise<CommerceCustomer | null>;
  save(customer: CommerceCustomer): Promise<void>;
}
export type CommerceCheckoutRecord = Readonly<{ id: string; providerSessionId: string; orderId: string; customerId: string; workspaceId?: string; productId: string; offerId: string; priceId: string; environment: CommerceEnvironment; status: "pending"|"cancelled"|"expired"; checkoutUrl?: string; expiresAt: Date; createdAt: Date }>;
export interface CommerceCheckoutRepository { save(value: CommerceCheckoutRecord): Promise<void>; findByProviderSession(id:string): Promise<CommerceCheckoutRecord|null>; }

export class CommerceCheckoutError extends Error { constructor(public readonly code:string,message:string){super(message);Object.freeze(this)}}

export async function resolveCommerceCustomer(store: CommerceCustomerStore, provider: CommerceProvider, input: Readonly<{ id:string; email:string; profileId?:string; workspaceId?:string; idempotencyKey:string; now?:Date }>) {
  const existing=await store.findByIdentity(input);
  if(existing?.providerReferences.stripeCustomerId)return existing;
  const customer: CommerceCustomer=existing??Object.freeze({id:input.id,...(input.profileId?{profileId:input.profileId}:{}),...(input.workspaceId?{workspaceId:input.workspaceId}:{}),email:input.email,providerReferences:Object.freeze({}),status:"active",createdAt:input.now??new Date()});
  const resolved=await provider.resolveCustomer({commerceCustomerId:customer.id,email:customer.email,existingProviderCustomerId:customer.providerReferences.stripeCustomerId,idempotencyKey:input.idempotencyKey});
  const mapped=Object.freeze({...customer,providerReferences:Object.freeze({stripeCustomerId:resolved.id})});
  await store.save(mapped); return mapped;
}

export async function createCommerceCheckout(dependencies: Readonly<{catalog:CommerceCatalogRepository;customers:CommerceCustomerStore;orders:CommerceOrderRepository;checkouts:CommerceCheckoutRepository;provider:CommerceProvider;environment:CommerceEnvironment}>, input: Readonly<{offerId:string;commerceCustomerId:string;email:string;profileId?:string;workspaceId?:string;baseUrl:string;idempotencyKey:string;now?:Date;successPath?:string;cancelPath?:string;addOns?: readonly Readonly<{name:string;amountMinor:number}>[]}>) {
  const [offers,products,prices]=await Promise.all([dependencies.catalog.listOffers(),dependencies.catalog.listProducts(),dependencies.catalog.listPrices()]);
  const offer=offers.find(value=>value.id===input.offerId&&value.status==="active"); if(!offer)throw new CommerceCheckoutError("OFFER_UNAVAILABLE","The selected offer is unavailable.");
  if(offer.productIds.length!==1||offer.priceIds.length!==1)throw new CommerceCheckoutError("OFFER_CHECKOUT_UNSUPPORTED","This offer is not eligible for single-session checkout.");
  const product=products.find(value=>value.id===offer.productIds[0]&&value.status==="active"),price=prices.find(value=>value.id===offer.priceIds[0]&&value.status==="active");
  if(!product||!price||price.productId!==product.id)throw new CommerceCheckoutError("CATALOG_CONFLICT","The offer catalog configuration is invalid.");
  const providerPriceId=price.providerReferences.stripePriceId;if(!providerPriceId)throw new CommerceCheckoutError("PRICE_NOT_CONFIGURED","Checkout pricing is not configured for this environment.");
  const customer=await resolveCommerceCustomer(dependencies.customers,dependencies.provider,{id:input.commerceCustomerId,email:input.email,profileId:input.profileId,workspaceId:input.workspaceId,idempotencyKey:`${input.idempotencyKey}:customer`,now:input.now});
  const now=input.now??new Date(),order=createCommerceOrder({id:`commerce-order-${crypto.randomUUID()}`,orderNumber:`LHC-${now.getTime()}`,customerId:customer.id,workspaceId:input.workspaceId,currency:price.amount.currency,lines:[{id:`commerce-line-${crypto.randomUUID()}`,product,price,quantity:1}],createdAt:now});
  await dependencies.orders.save(Object.freeze({...order,status:"pending-payment"} as CommerceOrder));
  const addOnsTotalMinor=(input.addOns??[]).reduce((sum,addOn)=>sum+addOn.amountMinor,0);
  const addOn=addOnsTotalMinor>0?{name:(input.addOns??[]).map(item=>item.name).join(", "),amountMinor:addOnsTotalMinor,currency:price.amount.currency}:undefined;
  const checkout=await dependencies.provider.createCheckoutSession({mode:price.type==="monthly"||price.type==="annual"?"subscription":"payment",providerCustomerId:customer.providerReferences.stripeCustomerId!,providerPriceId,quantity:1,successUrl:`${input.baseUrl}${input.successPath??"/checkout/success"}${(input.successPath??"").includes("?")?"&":"?"}session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${input.baseUrl}${input.cancelPath??"/checkout/cancel"}${(input.cancelPath??"").includes("?")?"&":"?"}order=${order.id}`,metadata:{...(input.workspaceId?{workspace_id:input.workspaceId}:{}),commerce_customer_id:customer.id,order_id:order.id,product_id:product.id,offer_id:offer.id},idempotencyKey:`${input.idempotencyKey}:checkout`,...(addOn?{addOn}:{})});
  const record:CommerceCheckoutRecord=Object.freeze({id:`commerce-checkout-${crypto.randomUUID()}`,providerSessionId:checkout.id,orderId:order.id,customerId:customer.id,...(input.workspaceId?{workspaceId:input.workspaceId}:{}),productId:product.id,offerId:offer.id,priceId:price.id,environment:dependencies.environment,status:"pending",...(checkout.url?{checkoutUrl:checkout.url}:{}),expiresAt:checkout.expiresAt,createdAt:now});await dependencies.checkouts.save(record);
  return Object.freeze({order,checkout:record,redirectUrl:checkout.url});
}

export async function getCheckoutSession(repo:CommerceCheckoutRepository,provider:CommerceProvider,id:string){const local=await repo.findByProviderSession(id);if(!local)return null;const remote=await provider.getCheckout(id);return Object.freeze({orderId:local.orderId,productId:local.productId,status:remote.status==="expired"?"expired":"pending",expiresAt:remote.expiresAt})}
