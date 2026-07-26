import type {GuidebookBlockType} from "./guidebook";

export const guidebookSectionRegistry=Object.freeze([
 {key:"welcome",label:"Welcome",required:true},{key:"arrival",label:"Arrival",required:true},
 {key:"parking",label:"Parking",required:true},{key:"check-in",label:"Check-in",required:true},
 {key:"wi-fi",label:"Wi-Fi",required:true},{key:"house-rules",label:"House Rules",required:true},
 {key:"property-guide",label:"Property Guide",required:false},{key:"neighborhood",label:"Neighborhood",required:false},
 {key:"recommendations",label:"Recommendations",required:false},{key:"emergency",label:"Emergency",required:true},
 {key:"checkout",label:"Checkout",required:true},{key:"host-contact",label:"Host Contact",required:false},
] as const);

export const guidebookBlockRegistry=Object.freeze([
 {type:"heading",label:"Heading"},{type:"rich-text",label:"Paragraph"},{type:"rich-text",label:"Bullet list",variant:"bullet-list"},
 {type:"checklist",label:"Checklist"},{type:"image",label:"Image"},{type:"gallery",label:"Gallery"},
 {type:"divider",label:"Divider"},{type:"callout",label:"Callout"},{type:"rich-text",label:"Quote",variant:"quote"},
 {type:"button",label:"Button"},{type:"map",label:"Map"},
] satisfies readonly {type:GuidebookBlockType;label:string;variant?:string}[]);

export type GuidebookVariableKey="propertyName"|"wifi"|"parking"|"address"|"hostName"|"hostPhone"|"guidebookUrl"|"checkInTime"|"checkOutTime";
export type GuidebookVariableContext=Readonly<Record<GuidebookVariableKey,string|null|undefined>>;
export type VariableDiagnostic=Readonly<{token:string;key:string;status:"resolved"|"missing"|"unknown";value?:string;message:string}>;
export type CompositionBlock=Readonly<{id:string;type:string;position:number;content:Readonly<Record<string,unknown>>}>;
export type CompositionSection=Readonly<{id:string;key:string;title:string;position:number;visible:boolean;blocks:readonly CompositionBlock[]}>;

const variablePattern=/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;
export const guidebookVariableRegistry=Object.freeze([
 {key:"propertyName",label:"Property name"},{key:"wifi",label:"Wi-Fi"},{key:"parking",label:"Parking"},
 {key:"address",label:"Address"},{key:"hostName",label:"Host name"},{key:"hostPhone",label:"Host phone"},
 {key:"guidebookUrl",label:"Guidebook URL"},{key:"checkInTime",label:"Check-in time"},{key:"checkOutTime",label:"Checkout time"},
] satisfies readonly {key:GuidebookVariableKey;label:string}[]);

export function resolveGuidebookVariables(text:string,context:GuidebookVariableContext){
 const diagnostics:VariableDiagnostic[]=[];
 const value=text.replace(variablePattern,(token,key:string)=>{
  if(!guidebookVariableRegistry.some(item=>item.key===key)){diagnostics.push({token,key,status:"unknown",message:`${token} is not a supported property variable.`});return token;}
  const resolved=context[key as GuidebookVariableKey];
  if(!resolved){diagnostics.push({token,key,status:"missing",message:`${token} has no operational value for this property.`});return token;}
  diagnostics.push({token,key,status:"resolved",value:resolved,message:`${token} resolves from canonical property data.`});return resolved;
 });
 return deepFreeze({value,diagnostics});
}

export function validateGuidebookComposition(sections:readonly CompositionSection[],context:GuidebookVariableContext){
 const issues:{code:string;sectionKey?:string;blockId?:string;message:string;blocking:boolean}[]=[];
 for(const definition of guidebookSectionRegistry.filter(item=>item.required)){
  const section=sections.find(item=>item.key===definition.key);
  if(!section||!section.visible||!section.blocks.length)issues.push({code:"required-section-incomplete",sectionKey:definition.key,message:`${definition.label} needs guest-facing content.`,blocking:true});
 }
 for(const section of sections)for(const block of section.blocks){
  const text=blockText(block);
  for(const diagnostic of resolveGuidebookVariables(text,context).diagnostics.filter(item=>item.status!=="resolved"))issues.push({code:`variable-${diagnostic.status}`,sectionKey:section.key,blockId:block.id,message:diagnostic.message,blocking:true});
  if(block.type==="image"&&!String(block.content.alt??"").trim())issues.push({code:"image-alt-missing",sectionKey:section.key,blockId:block.id,message:"Image alt text is required for accessible publishing.",blocking:true});
 }
 const blocking=issues.filter(issue=>issue.blocking).length;
 return deepFreeze({status:blocking?"requires-attention":"ready" as "requires-attention"|"ready",ready:blocking===0,completeRequired:guidebookSectionRegistry.filter(item=>item.required).length-issues.filter(issue=>issue.code==="required-section-incomplete").length,totalRequired:guidebookSectionRegistry.filter(item=>item.required).length,issues});
}

export function blockText(block:CompositionBlock){return String(block.content.markdown??block.content.text??block.content.label??block.content.caption??"");}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze)}return value;}
