import type { ReservationContext, StayStage } from "@/features/reservation-context";
import type { ConversationAggregate, SuggestedConversationAction } from "./conversation-engine";

export type ContextValue<T> =
  | Readonly<{ state: "available"; value: T }>
  | Readonly<{ state: "unavailable" | "unknown" | "not-applicable"; reason: string; recovery?: string }>;
export type GuestContextQuality = "fresh" | "stale" | "unavailable" | "partially-available" | "missing";
export type GuestContextConfidence = "high" | "moderate" | "limited";
export type GuestContextPermission = "summary" | "operational" | "manager" | "owner" | "administrator";
export type OperationalIssueInput = Readonly<{ id: string; type: "maintenance" | "cleaning" | "inspection" | "task" | "payment" | "guidebook" | "access"; title: string; status: string; priority: string; createdAt: string }>;
export type PropertyCommunicationInput = Readonly<{
  address?: string | null; amenities?: readonly string[]; houseRules?: readonly string[];
  doorCode?: string | null; parking?: string | null; wifi?: string | null; emergencyContact?: string | null;
  updatedAt?: string | null;
}>;
export type GuidebookContextInput = Readonly<{ id: string; status: string; publicUrl?: string; version?: number | null; updatedAt?: string | null }>;
export type GuestHistoryInput = Readonly<{ previousStayCount: number; previousConversationCount: number; guestSince?: string | null; knownPreferences?: readonly string[] }>;
export type RecentContextEvent = Readonly<{ id: string; type: string; summary: string; occurredAt: string }>;

export type GuestContextProjection = Readonly<{
  projectionVersion: "guest-context-projection.v1";
  generatedAt: string;
  identity: Readonly<{ workspaceId: string; guestId: string; conversationId: string; reservationId: string; propertyId: string }>;
  guest: Readonly<{
    name: string; preferredName: ContextValue<string>; language: ContextValue<string>;
    communicationPreference: ContextValue<string>; email: ContextValue<string>; phone: ContextValue<string>;
    guestSince: ContextValue<string>; repeatStayCount: number; status: "new-guest" | "returning-guest" | "internal-review";
  }>;
  reservation: Readonly<{
    id: string; confirmation: ContextValue<string>; arrival: string; departure: string; lengthOfStay: number;
    adults: ContextValue<number>; children: ContextValue<number>; pets: ContextValue<number>;
    bookingSource: string; status: string; stage: StayStage;
  }>;
  property: Readonly<{
    id: string; name: string; address: ContextValue<string>; timezone: string; operationalStatus: string;
    guidebookStatus: ContextValue<string>; doorCode: ContextValue<string>; parking: ContextValue<string>;
    wifi: ContextValue<string>; emergencyContact: ContextValue<string>; houseRulesVersion: ContextValue<string>;
  }>;
  operations: Readonly<{ issues: readonly OperationalIssueInput[]; blockers: readonly OperationalIssueInput[] }>;
  communication: Readonly<{
    status: ConversationAggregate["status"]; unreadCount: number; waitingOn: ConversationAggregate["waitingOn"];
    lastReply: ContextValue<string>; lastSent: ContextValue<string>; lastViewed: ContextValue<string>;
  }>;
  guidebook: Readonly<{ exists: boolean; status: ContextValue<string>; publicUrl: ContextValue<string>; needsUpdate: boolean }>;
  history: Readonly<{ previousStayCount: number; previousConversationCount: number; knownPreferences: readonly string[] }>;
  provider: Readonly<{ connected: boolean; synchronizationStatus: string; lastSync: ContextValue<string>; conversationSource: string }>;
  timelineSummary: readonly RecentContextEvent[];
  suggestedActions: readonly SuggestedConversationAction[];
  dataQuality: Readonly<{
    state: GuestContextQuality; confidence: GuestContextConfidence; completeness: number;
    missing: readonly string[]; stale: readonly string[];
    guidance: string;
    sources: Readonly<{ reservation: GuestContextQuality; conversation: GuestContextQuality; property: GuestContextQuality; guidebook: GuestContextQuality; operations: GuestContextQuality }>;
  }>;
  permissions: Readonly<{ level: GuestContextPermission; contactDetails: boolean; financialDetails: boolean }>;
}>;

export function buildGuestContextProjection(input: Readonly<{
  workspaceId: string; conversation: ConversationAggregate; reservation: ReservationContext;
  property?: PropertyCommunicationInput; guidebook?: GuidebookContextInput | null; issues?: readonly OperationalIssueInput[];
  history?: GuestHistoryInput; recentEvents?: readonly RecentContextEvent[];
  provider: Readonly<{ connected: boolean; status: string; lastSynchronizedAt?: string }>;
  permission: GuestContextPermission; generatedAt?: string;
}>): GuestContextProjection {
  const generatedAt=input.generatedAt??new Date().toISOString(),contactDetails=["owner","administrator"].includes(input.permission);
  const history=input.history??{previousStayCount:0,previousConversationCount:0,knownPreferences:[]};
  const property=input.property??{},issues=Object.freeze([...(input.issues??[])]);
  const missing:string[]=[];
  if(!input.reservation.provenance.lastObservedAt)missing.push("reservation synchronization");
  if(!input.guidebook)missing.push("published guidebook");
  if(!property.address)missing.push("property address");
  if(!property.doorCode)missing.push("door code");
  const stale:string[]=[];
  if(input.reservation.freshness.status==="stale")stale.push("reservation");
  if(!input.provider.connected)stale.push("provider connection");
  const completeness=Math.max(0,Math.round(((8-missing.length)/8)*100));
  const confidence:GuestContextConfidence=!input.provider.connected||completeness<60?"limited":stale.length||completeness<90?"moderate":"high";
  const state:GuestContextQuality=!input.reservation?"unavailable":stale.length?"stale":missing.length?"partially-available":"fresh";
  const inbound=[...input.conversation.messages].reverse().find(message=>message.direction==="inbound");
  const outbound=[...input.conversation.messages].reverse().find(message=>message.direction==="outbound");
  const lengthOfStay=Math.max(0,Math.round((Date.parse(`${input.reservation.stay.window.departureDate}T00:00:00Z`)-Date.parse(`${input.reservation.stay.window.arrivalDate}T00:00:00Z`))/86_400_000));
  const blockers=issues.filter(issue=>issue.status!=="resolved"&&["high","urgent"].includes(issue.priority));
  const guidebookStatus=input.guidebook?available(input.guidebook.status):unavailable("No guidebook is available for this property.","Open Guidebook Studio");
  const actions=buildGuestContextActions(input.conversation,input.reservation,input.guidebook,issues,property);
  return deepFreeze({
    projectionVersion:"guest-context-projection.v1",generatedAt,
    identity:{workspaceId:input.workspaceId,guestId:input.conversation.guestId,conversationId:input.conversation.id,reservationId:input.reservation.reservationId,propertyId:input.conversation.propertyId},
    guest:{
      name:input.reservation.guest.name.display,
      preferredName:input.reservation.guest.name.given?available(input.reservation.guest.name.given):unknown("A preferred name has not been supplied."),
      language:input.reservation.guest.language?available(input.reservation.guest.language):unknown("Guest language is not available."),
      communicationPreference:input.reservation.contactAvailability.preferredChannel?available(input.reservation.contactAvailability.preferredChannel):unknown("No communication preference is known."),
      email:contactDetails?contact(input.reservation,"email"):unavailable("Contact details are hidden for this role."),
      phone:contactDetails?contact(input.reservation,"phone"):unavailable("Contact details are hidden for this role."),
      guestSince:history.guestSince?available(history.guestSince):unknown("Guest history does not include a first-stay date."),
      repeatStayCount:history.previousStayCount,
      status:input.reservation.guest.identity.status==="ambiguous"?"internal-review":history.previousStayCount>0?"returning-guest":"new-guest",
    },
    reservation:{
      id:input.reservation.reservationId,
      confirmation:input.reservation.provenance.externalReservationId?available(input.reservation.provenance.externalReservationId):unknown("Provider confirmation is unavailable."),
      arrival:input.reservation.stay.window.arrivalDate,departure:input.reservation.stay.window.departureDate,lengthOfStay,
      adults:numberValue(input.reservation.party.adults,"Adult count is unavailable."),
      children:numberValue(input.reservation.party.children,"Child count is unavailable."),
      pets:numberValue(input.reservation.party.pets,"Pet count is unavailable."),
      bookingSource:input.reservation.source.bookingSource,status:stageStatus(input.reservation.stay.stage),stage:input.reservation.stay.stage,
    },
    property:{
      id:input.reservation.property.id,name:input.reservation.property.name,
      address:property.address?available(property.address):unavailable("Property address is unavailable.","Review property details"),
      timezone:input.reservation.property.timezone,operationalStatus:input.reservation.property.operationalStatus,
      guidebookStatus,doorCode:property.doorCode?available(property.doorCode):unavailable("Door code is not available.","Add access instructions"),
      parking:property.parking?available(property.parking):unknown("Parking guidance is not recorded."),
      wifi:property.wifi?available(property.wifi):unknown("Wi-Fi guidance is not recorded."),
      emergencyContact:property.emergencyContact?available(property.emergencyContact):unknown("Emergency contact is not recorded."),
      houseRulesVersion:property.houseRules?.length?available(property.updatedAt??generatedAt):unavailable("House rules are not available.","Update property house rules"),
    },
    operations:{issues,blockers},
    communication:{status:input.conversation.status,unreadCount:input.conversation.unreadCount,waitingOn:input.conversation.waitingOn,lastReply:inbound?available(inbound.sentAt):notApplicable("No guest reply has been received."),lastSent:outbound?available(outbound.sentAt):notApplicable("No operator reply has been sent."),lastViewed:unknown("Per-user view tracking is not available yet.")},
    guidebook:{exists:Boolean(input.guidebook),status:guidebookStatus,publicUrl:input.guidebook?.publicUrl?available(input.guidebook.publicUrl):notApplicable("No published guidebook URL is available."),needsUpdate:Boolean(input.guidebook&&property.updatedAt&&input.guidebook.updatedAt&&Date.parse(property.updatedAt)>Date.parse(input.guidebook.updatedAt))},
    history:{previousStayCount:history.previousStayCount,previousConversationCount:history.previousConversationCount,knownPreferences:Object.freeze([...(history.knownPreferences??[])])},
    provider:{connected:input.provider.connected,synchronizationStatus:input.provider.status,lastSync:input.provider.lastSynchronizedAt?available(input.provider.lastSynchronizedAt):unavailable("Provider synchronization has not completed.","Reconnect or synchronize the provider"),conversationSource:input.conversation.providerThreads[0]?.provider??"platform"},
    timelineSummary:Object.freeze([...(input.recentEvents??[])].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,8)),
    suggestedActions:actions,
    dataQuality:{state,confidence,completeness,missing:Object.freeze(missing),stale:Object.freeze(stale),guidance:qualityGuidance(state),sources:{reservation:quality(input.reservation.freshness.status),conversation:"fresh",property:property.updatedAt?"fresh":"partially-available",guidebook:input.guidebook?"fresh":"missing",operations:input.issues?"fresh":"unavailable"}},
    permissions:{level:input.permission,contactDetails,financialDetails:["owner","administrator"].includes(input.permission)},
  });
}

function buildGuestContextActions(conversation:ConversationAggregate,reservation:ReservationContext,guidebook:GuidebookContextInput|null|undefined,issues:readonly OperationalIssueInput[],property:PropertyCommunicationInput){
  const actions:SuggestedConversationAction[]=[];
  if(conversation.waitingOn==="operator")actions.push({key:"reply",label:"Reply to guest",reason:"The guest is waiting for an operator response."});
  if(["pre-arrival","arriving-today"].includes(reservation.stay.stage)&&!guidebook)actions.push({key:"guidebook",label:"Publish guidebook",reason:"Arrival is approaching and no published guidebook is available.",href:"/dashboard/guidebooks"});
  if(["pre-arrival","arriving-today"].includes(reservation.stay.stage)&&property.doorCode)actions.push({key:"check-in",label:"Send check-in instructions",reason:"The reservation is approaching arrival and access information is available.",templateCategory:"check-in"});
  if(["pre-arrival","arriving-today"].includes(reservation.stay.stage)&&!property.doorCode)actions.push({key:"access",label:"Add door code",reason:"Arrival communication is blocked because access details are unavailable.",href:"/dashboard/properties"});
  if(issues.some(issue=>issue.type==="maintenance"&&issue.status!=="resolved"))actions.push({key:"maintenance",label:"Maintenance follow-up",reason:"An unresolved maintenance issue may affect the guest stay.",href:"/dashboard/maintenance"});
  if(reservation.stay.stage==="departing-today")actions.push({key:"checkout",label:"Send checkout reminder",reason:"The active reservation departs today.",templateCategory:"checkout"});
  return Object.freeze(actions);
}
function contact(reservation:ReservationContext,type:"email"|"phone"){const point=reservation.guest.contactPoints.find(item=>item.type===type);return point?available(point.value):unavailable(`Guest ${type} is unavailable.`);}
function numberValue(value:number|null,reason:string):ContextValue<number>{return value===null?unknown(reason):available(value);}
function stageStatus(stage:StayStage){if(stage==="inquiry")return"booked";if(stage==="confirmed")return"booked";if(stage==="arriving-today")return"arrival-today";if(stage==="departing-today")return"checkout-today";if(stage==="post-stay"||stage==="closed")return"completed";return stage;}
function quality(status:ReservationContext["freshness"]["status"]):GuestContextQuality{return status==="current"?"fresh":status==="stale"?"stale":status==="degraded"?"partially-available":"unavailable";}
function qualityGuidance(state:GuestContextQuality){return state==="fresh"?"Context is current and complete enough for operational communication.":state==="stale"?"Some source information is stale. Refresh the provider before relying on time-sensitive details.":state==="partially-available"?"Available context remains usable; review explicit gaps before sending operational instructions.":"Core context is unavailable. Continue reviewing conversation history and restore the missing source.";}
function available<T>(value:T):ContextValue<T>{return Object.freeze({state:"available",value});}
function unavailable(reason:string,recovery?:string):ContextValue<never>{return Object.freeze({state:"unavailable",reason,...(recovery?{recovery}:{})});}
function unknown(reason:string):ContextValue<never>{return Object.freeze({state:"unknown",reason});}
function notApplicable(reason:string):ContextValue<never>{return Object.freeze({state:"not-applicable",reason});}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
