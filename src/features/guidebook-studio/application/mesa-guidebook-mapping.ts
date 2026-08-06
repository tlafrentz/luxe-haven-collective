import type { ComponentKey, GuidebookSectionKind, JourneyGroup } from "../domain/canonical-guidebook";

export type MesaSourceMapping=Readonly<{sourcePage:number;sourceLabel:string;kind:GuidebookSectionKind;journeyGroup:JourneyGroup;components:readonly ComponentKey[]}>;
export const MESA_GUIDEBOOK_IMPORT_MAPPING:readonly MesaSourceMapping[]=Object.freeze([
 {sourcePage:1,sourceLabel:"Cover",kind:"welcome",journeyGroup:"welcome",components:["hero"]},
 {sourcePage:2,sourceLabel:"Welcome message",kind:"property_overview",journeyGroup:"welcome",components:["rich_text","property_summary"]},
 {sourcePage:3,sourceLabel:"Check-in / checkout",kind:"arrival",journeyGroup:"arrival",components:["arrival_instructions","quick_actions"]},
 {sourcePage:4,sourceLabel:"Wi-Fi",kind:"wifi",journeyGroup:"stay",components:["wifi_card"]},
 {sourcePage:5,sourceLabel:"House rules",kind:"house_rules",journeyGroup:"stay",components:["rule_grid"]},
 {sourcePage:6,sourceLabel:"Appliances",kind:"appliances",journeyGroup:"stay",components:["appliance_card"]},
 {sourcePage:7,sourceLabel:"FAQ",kind:"faq",journeyGroup:"stay",components:["faq_accordion"]},
 {sourcePage:8,sourceLabel:"Hiking safety",kind:"safety",journeyGroup:"stay",components:["safety_notice"]},
 {sourcePage:9,sourceLabel:"Emergency information",kind:"emergency",journeyGroup:"stay",components:["emergency_contact_card","hospital_card"]},
 {sourcePage:10,sourceLabel:"Getting around",kind:"transportation",journeyGroup:"explore",components:["transportation_link_card","map_link"]},
 {sourcePage:11,sourceLabel:"Things to do",kind:"things_to_do",journeyGroup:"explore",components:["recommendation_collection"]},
 {sourcePage:12,sourceLabel:"Where to eat",kind:"restaurants",journeyGroup:"explore",components:["recommendation_collection"]},
 {sourcePage:13,sourceLabel:"Going out",kind:"nightlife",journeyGroup:"explore",components:["recommendation_collection"]},
 {sourcePage:14,sourceLabel:"Where to buy",kind:"shopping",journeyGroup:"explore",components:["recommendation_collection"]},
 {sourcePage:15,sourceLabel:"Before you go",kind:"departure",journeyGroup:"departure",components:["departure_checklist"]},
 {sourcePage:16,sourceLabel:"Review request",kind:"review_request",journeyGroup:"follow_up",components:["review_cta"]},
 {sourcePage:17,sourceLabel:"Stay in touch",kind:"stay_connected",journeyGroup:"follow_up",components:["social_links"]},
 {sourcePage:18,sourceLabel:"Thank you",kind:"thank_you",journeyGroup:"follow_up",components:["thank_you_panel"]},
]);
export function createMesaImportProposals(importJobId:string){return MESA_GUIDEBOOK_IMPORT_MAPPING.flatMap((mapping,index)=>[{id:`${importJobId}:section:${index}`,importJobId,proposedEntityType:"section" as const,sourceReference:`pdf:page:${mapping.sourcePage}`,proposedPayload:{kind:mapping.kind,title:mapping.sourceLabel,journeyGroup:mapping.journeyGroup,sortOrder:index},confidence:"high" as const,reviewStatus:"pending" as const,reviewedBy:null,reviewedAt:null},...mapping.components.map((component,componentIndex)=>({id:`${importJobId}:component:${index}:${componentIndex}`,importJobId,proposedEntityType:"component" as const,sourceReference:`pdf:page:${mapping.sourcePage}`,proposedPayload:{componentKey:component,sectionKind:mapping.kind,sortOrder:componentIndex},confidence:"medium" as const,reviewStatus:"pending" as const,reviewedBy:null,reviewedAt:null}))]);}
