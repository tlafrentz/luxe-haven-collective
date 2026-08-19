import{describe,expect,it,vi}from"vitest";vi.mock("server-only",()=>({}));import{creationAssistantCapability}from"./application";import{extractionResultSchema,generationReadiness,inspectSource,sanitizeFilename,SOURCE_LIMITS,type ExtractedFact,type ExtractedNarrativeSection}from"./domain";
describe("Creation Assistant boundaries",()=>{it("inspects content rather than extensions",()=>{expect(inspectSource(new Uint8Array([0x25,0x50,0x44,0x46,0x2d]),"application/pdf")).toBe("pdf");expect(inspectSource(new Uint8Array([0x4d,0x5a,0x90]),"application/pdf")).toBeNull();expect(inspectSource(new TextEncoder().encode("safe text"),"text/plain")).toBe("text")});it("sanitizes names and centralizes limits",()=>{expect(sanitizeFilename("../../house manual?.pdf")).toBe("..-..-house-manual-.pdf");expect(SOURCE_LIMITS.count).toBe(20)});it("rejects permanent secret values and ungrouped conflicts",()=>{expect(()=>extractionResultSchema.parse({facts:[{category:"wifi",field:"credentials",normalizedValue:"secret",reviewStatus:"needs_review",sensitivity:"secret",highRisk:true}],missing:[],warnings:[],mediaCandidates:[],unsupported:[],narrativeSections:[]})).toThrow();expect(()=>extractionResultSchema.parse({facts:[{category:"rules",field:"quiet_hours",normalizedValue:"10pm",reviewStatus:"conflicting",sensitivity:"internal",highRisk:true}],missing:[],warnings:[],mediaCandidates:[],unsupported:[],narrativeSections:[]})).toThrow()});it("keeps customer visibility closed until global and vertical-slice enablement",()=>{const ready={migrationApplied:true,storageValid:true,extractionConfigured:true,generationConfigured:true,templateReady:true,componentsReady:true,backgroundHealthy:true,entitled:true,contextValid:true,globalEnabled:true,workspaceEnabled:true,controlledCohort:true,verticalSliceVerified:false};expect(creationAssistantCapability(ready)).toEqual({internalAvailable:true,customerVisible:false,reasons:[]});expect(creationAssistantCapability({...ready,verticalSliceVerified:true}).customerVisible).toBe(true);expect(creationAssistantCapability({...ready,globalEnabled:false,verticalSliceVerified:true})).toEqual({internalAvailable:true,customerVisible:false,reasons:[]});expect(creationAssistantCapability({...ready,storageValid:false}).internalAvailable).toBe(false)})});

describe("Narrative section extraction",()=>{
  it("accepts a well-formed narrative section alongside facts",()=>{
    expect(()=>extractionResultSchema.parse({facts:[],missing:[],warnings:[],mediaCandidates:[],unsupported:[],narrativeSections:[{title:"Things To Do",body:"Visit the local park and enjoy the trails.",sourceLocation:"Things To Do",reviewStatus:"needs_review"}]})).not.toThrow();
  });
  it("rejects a narrative section with an empty body or an out-of-enum review status",()=>{
    expect(()=>extractionResultSchema.parse({facts:[],missing:[],warnings:[],mediaCandidates:[],unsupported:[],narrativeSections:[{title:"FAQ",body:"",reviewStatus:"needs_review"}]})).toThrow();
    expect(()=>extractionResultSchema.parse({facts:[],missing:[],warnings:[],mediaCandidates:[],unsupported:[],narrativeSections:[{title:"FAQ",body:"Some content.",reviewStatus:"pre_confirmed"}]})).toThrow();
  });
  it("requires every narrative section to resolve before generation is ready, independent of facts",()=>{
    const facts:ExtractedFact[]=[];
    const pending:ExtractedNarrativeSection[]=[{id:"s1",jobId:"job-1",title:"Things To Do",body:"Visit the park.",reviewStatus:"needs_review",confirmed:false}];
    expect(generationReadiness(facts,pending).ready).toBe(false);
    expect(generationReadiness(facts,pending).unresolvedSections).toHaveLength(1);
    const confirmed:ExtractedNarrativeSection[]=[{...pending[0]!,reviewStatus:"confirmed",confirmed:true}];
    expect(generationReadiness(facts,confirmed).ready).toBe(true);
    const rejected:ExtractedNarrativeSection[]=[{...pending[0]!,reviewStatus:"rejected",confirmed:false}];
    expect(generationReadiness(facts,rejected).ready).toBe(true);
  });
  it("defaults to ready when no narrative sections are supplied, preserving the original fact-only signature",()=>{
    expect(generationReadiness([]).ready).toBe(true);
  });
});
