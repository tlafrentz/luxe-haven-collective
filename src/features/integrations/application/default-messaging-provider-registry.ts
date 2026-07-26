import{hospitableMessagingAdapter}from"../hospitable/lib/messaging-adapter";
import{MessagingProviderRegistry}from"./messaging-provider-registry";
export const DEFAULT_MESSAGING_PROVIDER_REGISTRY=new MessagingProviderRegistry().register(hospitableMessagingAdapter);
