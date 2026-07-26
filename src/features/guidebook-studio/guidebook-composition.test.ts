import {describe,expect,it} from "vitest";
import {guidebookBlockRegistry,guidebookSectionRegistry,resolveGuidebookVariables,validateGuidebookComposition,type CompositionSection,type GuidebookVariableContext} from "./domain/guidebook-composition";

const context:GuidebookVariableContext={propertyName:"Lake House",wifi:"Network details",parking:"Driveway",address:"1 Lake Road",hostName:"Alex",hostPhone:"555-0100",guidebookUrl:"/g/lake",checkInTime:"4 PM",checkOutTime:"10 AM"};
const requiredSections:CompositionSection[]=guidebookSectionRegistry.filter(item=>item.required).map((item,position)=>({id:item.key,key:item.key,title:item.label,position,visible:true,blocks:[{id:`${item.key}-block`,type:"rich-text",position:0,content:{markdown:`Welcome to {{propertyName}}. ${item.label}`}}]}));

describe("Guidebook composition",()=>{
 it("publishes a reusable registry of experience sections and blocks",()=>{
  expect(guidebookSectionRegistry.find(item=>item.key==="emergency")?.required).toBe(true);
  expect(guidebookBlockRegistry.map(item=>item.label)).toEqual(expect.arrayContaining(["Heading","Gallery","Checklist","Map"]));
 });
 it("resolves canonical property variables without changing source content",()=>{
  const source="Welcome to {{propertyName}}. Check in at {{checkInTime}}.";
  const result=resolveGuidebookVariables(source,context);
  expect(result.value).toBe("Welcome to Lake House. Check in at 4 PM.");
  expect(source).toContain("{{propertyName}}");
  expect(result.diagnostics.every(item=>item.status==="resolved")).toBe(true);
 });
 it("distinguishes missing and unknown variables",()=>{
  const result=resolveGuidebookVariables("Call {{hostPhone}} about {{doorCode}}.",{...context,hostPhone:null});
  expect(result.diagnostics.map(item=>item.status)).toEqual(["missing","unknown"]);
 });
 it("blocks publication when required sections or variables are incomplete",()=>{
  const result=validateGuidebookComposition(requiredSections.filter(section=>section.key!=="emergency").map(section=>section.key==="welcome"?{...section,blocks:[{...section.blocks[0],content:{markdown:"{{doorCode}}"}}]}:section),context);
  expect(result.ready).toBe(false);
  expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(["required-section-incomplete","variable-unknown"]));
 });
 it("requires accessible alt text for image blocks",()=>{
  const sections=requiredSections.map(section=>section.key==="welcome"?{...section,blocks:[{id:"image",type:"image",position:0,content:{url:"https://example.com/image.jpg",alt:""}}]}:section);
  expect(validateGuidebookComposition(sections,context).issues.map(issue=>issue.code)).toContain("image-alt-missing");
 });
 it("reports a complete draft as ready",()=>expect(validateGuidebookComposition(requiredSections,context).ready).toBe(true));
});
