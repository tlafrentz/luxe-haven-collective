import type{MessagingProviderAdapter,MessagingProviderCapability}from"../domain/messaging-provider";
export class MessagingProviderRegistry{
 private readonly adapters=new Map<string,MessagingProviderAdapter>();
 register(adapter:MessagingProviderAdapter){if(!adapter.id.trim())throw new TypeError("messaging_provider_id_required");if(this.adapters.has(adapter.id))throw new RangeError(`messaging_provider_duplicate:${adapter.id}`);this.adapters.set(adapter.id,adapter);return this;}
 get(id:string){return this.adapters.get(id);}
 require(id:string){const adapter=this.get(id);if(!adapter)throw new Error("unsupported-capability");return adapter;}
 supporting(capability:MessagingProviderCapability){return Object.freeze([...this.adapters.values()].filter(adapter=>adapter.capabilities.includes(capability)));}
 descriptors(){return Object.freeze([...this.adapters.values()].map(adapter=>Object.freeze({id:adapter.id,name:adapter.name,version:adapter.version,channels:adapter.channels,capabilities:adapter.capabilities,configuration:adapter.configuration()})));}
}
