export type GuestTimelineCategory="messages"|"reservations"|"operations"|"maintenance"|"guidebooks"|"reviews"|"notes"|"learning";
export type GuestTimelineVisibility="internal"|"operational";
export type GuestTimelineEvent=Readonly<{
 id:string;sequence:number;workspaceId:string;guestId:string;occurredAt:string;recordedAt:string;
 eventType:string;category:GuestTimelineCategory;visibility:GuestTimelineVisibility;summary:string;
 actor:Readonly<{type:"guest"|"operator"|"provider"|"system";id?:string;displayName?:string}>;
 reservationId?:string;bookingId?:string;propertyId?:string;conversationId?:string;messageId?:string;
 source:Readonly<{type:string;id:string;version?:string}>;metadata:Readonly<Record<string,unknown>>;
}>;
export type GuestTimelineAggregate=Readonly<{workspaceId:string;guestId:string;firstEventAt?:string;latestEventAt?:string;eventCount:number;lastUpdatedAt?:string;events:readonly GuestTimelineEvent[]}>;
export type GuestRelationshipSummary=Readonly<{
 guestSince?:string;recognition:"first-stay"|"returning-guest"|"frequent-guest"|"vip";
 completedStays:number;lifetimeNights:number;preferredPropertyId?:string;communicationPreference?:string;
 lastStay?:Readonly<{arrival:string;departure:string;propertyId?:string}>;outstandingIssueCount:number;
 insights:Readonly<{averageResponseMinutes?:number;typicalStayLength?:number;repeatVisitFrequencyDays?:number;mostVisitedPropertyId?:string;commonIssueTypes:readonly string[]}>;
}>;
export type GuestTimelineEventDefinition=Readonly<{type:string;category:GuestTimelineCategory;label:string;futureReady?:boolean}>;
export class GuestTimelineEventRegistry{
 private definitions=new Map<string,GuestTimelineEventDefinition>();
 register(definition:GuestTimelineEventDefinition){if(!definition.type.trim())throw new Error("guest_timeline_event_type_required");if(this.definitions.has(definition.type))throw new Error("guest_timeline_event_type_duplicate");this.definitions.set(definition.type,Object.freeze({...definition}));return this;}
 get(type:string){return this.definitions.get(type);}
 category(type:string){return this.get(type)?.category??"operations";}
 values(){return Object.freeze([...this.definitions.values()]);}
}
export const DEFAULT_GUEST_TIMELINE_EVENTS=new GuestTimelineEventRegistry();
for(const definition of[
 ["reservation-created","reservations","Reservation created"],["reservation-updated","reservations","Reservation updated"],["reservation-cancelled","reservations","Reservation cancelled"],["check-in","reservations","Check-in"],["checkout","reservations","Checkout"],["message-sent","messages","Message sent"],["guest-replied","messages","Guest replied"],["message-delivered","messages","Message delivered"],["message-read","messages","Message read"],["template-used","messages","Template used"],["check-in-reminder-sent","messages","Check-in reminder sent"],["attachment-added","messages","Attachment added"],["internal-note","notes","Internal note"],["conversation-archived","messages","Conversation archived"],["guidebook-published","guidebooks","Guidebook published"],["maintenance-issue","maintenance","Maintenance issue"],["maintenance-resolved","maintenance","Maintenance resolved"],["review-requested","reviews","Review requested"],["review-submitted","reviews","Review submitted"],["cleaning-event","operations","Cleaning event"],["property-access","operations","Property access"],["learning-event","learning","Learning event"],
]as const)DEFAULT_GUEST_TIMELINE_EVENTS.register({type:definition[0],category:definition[1],label:definition[2]});

export function createGuestTimelineAggregate(input:Readonly<{workspaceId:string;guestId:string;events:readonly GuestTimelineEvent[]}>):GuestTimelineAggregate{
 const events=Object.freeze([...input.events].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence));
 return deepFreeze({workspaceId:input.workspaceId,guestId:input.guestId,...(events[0]?{firstEventAt:events[0].occurredAt}:{}),...(events.at(-1)?{latestEventAt:events.at(-1)!.occurredAt,lastUpdatedAt:events.at(-1)!.recordedAt}:{}),eventCount:events.length,events});
}
export function queryGuestTimeline(events:readonly GuestTimelineEvent[],input:Readonly<{categories?:readonly GuestTimelineCategory[];query?:string;reservationId?:string;propertyId?:string;eventType?:string;dateFrom?:string;dateTo?:string;order?:"newest"|"oldest";limit?:number;afterSequence?:number}>){
 const query=input.query?.trim().toLowerCase(),filtered=events.filter(event=>(!input.categories?.length||input.categories.includes(event.category))&&(!input.reservationId||event.reservationId===input.reservationId)&&(!input.propertyId||event.propertyId===input.propertyId)&&(!input.eventType||event.eventType===input.eventType)&&(!input.dateFrom||event.occurredAt>=input.dateFrom)&&(!input.dateTo||event.occurredAt<=input.dateTo)&&(!input.afterSequence||(input.order==="oldest"?event.sequence>input.afterSequence:event.sequence<input.afterSequence))&&(!query||[event.summary,event.eventType,event.reservationId,event.propertyId,event.actor.displayName,...Object.values(event.metadata)].some(value=>String(value??"").toLowerCase().includes(query))));
 const ordered=[...filtered].sort((a,b)=>(input.order==="oldest"?1:-1)*(Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||(a.sequence-b.sequence))),limit=Math.min(100,Math.max(1,input.limit??50)),page=ordered.slice(0,limit);
 return Object.freeze({events:Object.freeze(page),nextCursor:ordered.length>limit?page.at(-1)?.sequence:undefined,hasMore:ordered.length>limit});
}
export function buildGuestRelationshipSummary(events:readonly GuestTimelineEvent[]):GuestRelationshipSummary{
 const reservations=new Map<string,{arrival?:string;departure?:string;propertyId?:string;completed:boolean}>(),propertyVisits=new Map<string,number>(),issueTypes=new Map<string,number>(),responses:number[]=[];
 let outstanding=0,lastInbound:GuestTimelineEvent|undefined,preference:string|undefined;
 for(const event of[...events].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence)){
  if(event.reservationId&&event.category==="reservations"){const stay=reservations.get(event.reservationId)??{completed:false};if(typeof event.metadata.arrival==="string")stay.arrival=event.metadata.arrival;if(typeof event.metadata.departure==="string")stay.departure=event.metadata.departure;if(event.propertyId)stay.propertyId=event.propertyId;if(event.eventType==="checkout"||event.metadata.status==="completed")stay.completed=true;reservations.set(event.reservationId,stay);}
  if(event.eventType==="guest-replied")lastInbound=event;
  if(event.eventType==="message-sent"&&lastInbound){const minutes=(Date.parse(event.occurredAt)-Date.parse(lastInbound.occurredAt))/60_000;if(minutes>=0)responses.push(minutes);lastInbound=undefined;}
  if(event.eventType==="maintenance-issue"){outstanding++;const type=String(event.metadata.issueType??"maintenance");issueTypes.set(type,(issueTypes.get(type)??0)+1);}
  if(event.eventType==="maintenance-resolved")outstanding=Math.max(0,outstanding-1);
  if(typeof event.metadata.communicationPreference==="string")preference=event.metadata.communicationPreference;
 }
 const completed=[...reservations.values()].filter(stay=>stay.completed),lengths=completed.map(stay=>stay.arrival&&stay.departure?Math.max(0,(Date.parse(`${stay.departure}T00:00:00Z`)-Date.parse(`${stay.arrival}T00:00:00Z`))/86_400_000):0);for(const stay of completed)if(stay.propertyId)propertyVisits.set(stay.propertyId,(propertyVisits.get(stay.propertyId)??0)+1);
 const preferred=[...propertyVisits].sort((a,b)=>b[1]-a[1])[0]?.[0],sortedStays=completed.filter(stay=>stay.arrival&&stay.departure).sort((a,b)=>String(a.departure).localeCompare(String(b.departure))),frequencies=sortedStays.slice(1).map((stay,index)=>(Date.parse(`${stay.arrival}T00:00:00Z`)-Date.parse(`${sortedStays[index].departure}T00:00:00Z`))/86_400_000).filter(days=>days>=0);
 const count=completed.length,recognition=count>=10?"vip":count>=5?"frequent-guest":count>=2?"returning-guest":"first-stay";
 return deepFreeze({...(events[0]?{guestSince:[...events].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence)[0].occurredAt}:{}),recognition,completedStays:count,lifetimeNights:lengths.reduce((sum,value)=>sum+value,0),...(preferred?{preferredPropertyId:preferred}:{}),...(preference?{communicationPreference:preference}:{}),...(sortedStays.at(-1)?{lastStay:{arrival:sortedStays.at(-1)!.arrival!,departure:sortedStays.at(-1)!.departure!,...(sortedStays.at(-1)!.propertyId?{propertyId:sortedStays.at(-1)!.propertyId}:{})}}:{}),outstandingIssueCount:outstanding,insights:{...(responses.length?{averageResponseMinutes:responses.reduce((sum,value)=>sum+value,0)/responses.length}:{}),...(lengths.length?{typicalStayLength:lengths.reduce((sum,value)=>sum+value,0)/lengths.length}:{}),...(frequencies.length?{repeatVisitFrequencyDays:frequencies.reduce((sum,value)=>sum+value,0)/frequencies.length}:{}),...(preferred?{mostVisitedPropertyId:preferred}:{}),commonIssueTypes:Object.freeze([...issueTypes].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([type])=>type))}});
}
export function guestTimelineEventHref(event:GuestTimelineEvent){
 if(event.conversationId)return`/dashboard/communications/${event.conversationId}`;
 if(event.source.type==="guidebook-version"&&typeof event.metadata.guidebookId==="string")return`/dashboard/guidebooks/${event.metadata.guidebookId}`;
 if(event.source.type==="maintenance-request")return"/dashboard/maintenance";
 if(event.bookingId)return`/dashboard/bookings/${event.bookingId}`;
 return undefined;
}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
