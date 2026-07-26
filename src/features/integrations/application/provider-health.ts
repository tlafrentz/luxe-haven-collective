import type{ProviderHealth,ProviderHealthState}from"../domain/messaging-provider";
export function deriveProviderHealth(input:Readonly<{connectionStatus:string;lastSuccessfulSyncAt?:string;lastFailedSyncAt?:string;now?:Date;staleAfterMinutes?:number}>):ProviderHealth{
 const checkedAt=(input.now??new Date()).toISOString(),now=Date.parse(checkedAt),last=input.lastSuccessfulSyncAt?Date.parse(input.lastSuccessfulSyncAt):NaN,age=Number.isFinite(last)?Math.max(0,Math.round((now-last)/1000)):undefined;
 let state:ProviderHealthState=input.connectionStatus==="authorization-expired"?"unauthorized":input.connectionStatus==="disconnected"||input.connectionStatus==="paused"?"disconnected":input.connectionStatus==="error"?"degraded":"connected";
 if(state==="connected"&&(age===undefined||age>(input.staleAfterMinutes??30)*60))state="synchronization-stale";
 const freshness=age===undefined?"unknown":age<=300?"current":age<=(input.staleAfterMinutes??30)*60?"aging":"stale";
 const message=state==="connected"?"Provider messaging and synchronization are operational.":state==="synchronization-stale"?"Provider messaging may remain available, but synchronized context is stale.":state==="unauthorized"?"Provider authorization must be renewed before messaging can continue.":state==="degraded"?"Provider connectivity is degraded; safe retries remain available where supported.":"Provider messaging is disconnected.";
 return Object.freeze({state,checkedAt,...(input.lastSuccessfulSyncAt?{lastSuccessfulSyncAt:input.lastSuccessfulSyncAt}:{}),...(input.lastFailedSyncAt?{lastFailedSyncAt:input.lastFailedSyncAt}:{}),...(age===undefined?{}:{synchronizationAgeSeconds:age}),freshness,message});
}
