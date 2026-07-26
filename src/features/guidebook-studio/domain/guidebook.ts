export type GuidebookStatus = "draft"|"published"|"superseded"|"archived";
export type GuidebookBlockType = "heading"|"rich-text"|"image"|"gallery"|"video"|"map"|"callout"|"checklist"|"contact"|"button"|"link"|"divider";
export type RecommendationCategory = "restaurants"|"coffee"|"bars"|"groceries"|"pharmacy"|"hospital"|"activities"|"shopping"|"transportation";
export type GuidebookBlock = Readonly<{id:string;type:GuidebookBlockType;position:number;content:Readonly<Record<string,unknown>>;guestSafe:boolean}>;
export type GuidebookSection = Readonly<{id:string;key:string;title:string;position:number;visible:boolean;blocks:readonly GuidebookBlock[]}>;
export type GuidebookRecommendation = Readonly<{id:string;category:RecommendationCategory;title:string;description:string;address?:string;latitude?:number;longitude?:number;mapUrl?:string;website?:string;position:number}>;
export type GuidebookBrand = Readonly<{theme:"luxe-haven";logoUrl?:string;primaryColor:string;accentColor:string;coverImageUrl?:string}>;
export type PropertyGuidebookSnapshot = Readonly<{propertyId:string;name:string;address:string;city:string;state:string;checkInTime:string;checkoutTime:string;amenities:readonly string[];houseRules:readonly string[];latitude?:number;longitude?:number;sourceUpdatedAt:string}>;
export type Guidebook = Readonly<{id:string;workspaceId:string;propertyId:string;title:string;description:string;status:GuidebookStatus;currentVersion:number;publishedVersion?:number;publicSlug:string;sections:readonly GuidebookSection[];recommendations:readonly GuidebookRecommendation[];brand:GuidebookBrand;revision:number;createdAt:string;updatedAt:string}>;
export type GuidebookVersion = Readonly<{id:string;guidebookId:string;version:number;status:"published"|"superseded"|"unpublished";snapshot:Readonly<{title:string;description:string;sections:readonly GuidebookSection[];recommendations:readonly GuidebookRecommendation[];brand:GuidebookBrand;property:PropertyGuidebookSnapshot}>;publishedAt:string;createdAt:string}>;
export type PublishedGuidebook = Readonly<{title:string;description:string;publicSlug:string;version:number;sections:readonly GuidebookSection[];recommendations:readonly GuidebookRecommendation[];brand:GuidebookBrand;property:PropertyGuidebookSnapshot;publishedAt:string}>;

export class GuidebookError extends Error {
  constructor(public readonly code:"guidebook_invalid"|"guidebook_not_found"|"property_not_found"|"permission_denied"|"entitlement_required"|"revision_conflict"|"publication_invalid"|"public_guidebook_unavailable"|"unsafe_public_content"|"unexpected",message:string){super(message);this.name="GuidebookError";Object.freeze(this)}
}
export const defaultGuidebookSections = Object.freeze(["welcome","arrival","parking","check-in","wifi","property-guide","amenities","house-rules","neighborhood","restaurants","things-to-do","transportation","emergency","checkout"] as const);
export function createGuidebook(input:Omit<Guidebook,"status"|"currentVersion"|"publishedVersion"|"sections"|"recommendations"|"revision"> & {sections?:readonly GuidebookSection[]}):Guidebook{
 if(!input.workspaceId||!input.propertyId||!input.title.trim()||!isPublicSlug(input.publicSlug))throw new GuidebookError("guidebook_invalid","A Guidebook requires a Property, title, workspace, and secure public slug.");
 const sections=input.sections??defaultGuidebookSections.map((key,position)=>({id:`${input.id}-${key}`,key,title:title(key),position,visible:true,blocks:[]}));
 return deepFreeze({...input,title:input.title.trim(),status:"draft"as const,currentVersion:0,sections:[...sections].sort(byPosition),recommendations:[],revision:1});
}
export function updateGuidebookDraft(guidebook:Guidebook,input:Partial<Pick<Guidebook,"title"|"description"|"sections"|"recommendations"|"brand">>,expectedRevision:number):Guidebook{
 if(guidebook.revision!==expectedRevision)throw new GuidebookError("revision_conflict","The Guidebook changed while you were editing.");
 if(guidebook.status==="archived")throw new GuidebookError("guidebook_invalid","Archived Guidebooks cannot be edited.");
 return deepFreeze({...guidebook,...input,sections:[...(input.sections??guidebook.sections)].sort(byPosition),updatedAt:new Date().toISOString(),revision:guidebook.revision+1,status:guidebook.status==="published"?"published":guidebook.status});
}
export function publishGuidebook(guidebook:Guidebook,property:PropertyGuidebookSnapshot,publishedAt:string):Readonly<{guidebook:Guidebook;version:GuidebookVersion}>{
 const visible=guidebook.sections.filter(section=>section.visible);
 if(!visible.length||!visible.some(section=>section.blocks.length))throw new GuidebookError("publication_invalid","Add guest-safe content before publishing.");
 if(visible.some(section=>section.blocks.some(block=>!block.guestSafe)))throw new GuidebookError("unsafe_public_content","Remove private blocks before publishing.");
 const versionNumber=guidebook.currentVersion+1;
 const version=deepFreeze({id:`${guidebook.id}-v${versionNumber}`,guidebookId:guidebook.id,version:versionNumber,status:"published"as const,snapshot:{title:guidebook.title,description:guidebook.description,sections:visible,recommendations:guidebook.recommendations,brand:guidebook.brand,property},publishedAt,createdAt:publishedAt});
 return deepFreeze({guidebook:{...guidebook,status:"published",currentVersion:versionNumber,publishedVersion:versionNumber,updatedAt:publishedAt,revision:guidebook.revision+1},version});
}
export function projectPublishedGuidebook(guidebook:Guidebook,version:GuidebookVersion):PublishedGuidebook{
 if(guidebook.status!=="published"||version.status!=="published"||version.guidebookId!==guidebook.id)throw new GuidebookError("public_guidebook_unavailable","This Guidebook is not published.");
 return deepFreeze({...version.snapshot,publicSlug:guidebook.publicSlug,version:version.version,publishedAt:version.publishedAt});
}
export function isPublicSlug(value:string){return /^[a-z0-9_-]{16,80}$/.test(value)}
function title(key:string){return key.split("-").map(part=>part[0]?.toUpperCase()+part.slice(1)).join(" ")}
function byPosition(a:{position:number},b:{position:number}){return a.position-b.position}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze)}return value}
