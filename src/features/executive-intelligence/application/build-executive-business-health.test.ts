import{describe,expect,it}from"vitest";
import{buildExecutiveBusinessHealth,type BuildExecutiveBusinessHealthInput}from".";
const period={from:"2026-07-01",to:"2026-07-31"};
const evidence=(artifactId:string,capability:"financial"|"revenue"="financial")=>({capability,artifactType:`${capability}-snapshot`,artifactId,period,confidence:80,destination:`/dashboard/${capability}`,summary:`Canonical ${capability} evidence`}) as const;
function input():BuildExecutiveBusinessHealthInput{return{workspaceId:"w",period,generatedAt:"2026-07-28T12:00:00Z",pillars:[
  {pillar:"financial",score:40,confidence:80,evidence:[evidence("financial-1")],risks:["Cash runway is under pressure."],recommendation:{title:"Protect liquidity",whyItMatters:"Cash pressure limits operations.",suggestedNextAction:"Open Financial Intelligence.",businessImpact:90,destination:"/dashboard/financial"}},
  {pillar:"revenue",score:80,confidence:60,evidence:[evidence("revenue-1","revenue")],opportunities:["Pricing can improve high-demand dates."]},
]}}
describe("Executive Business Health projection",()=>{
  it("aggregates only available canonical pillar scores and keeps confidence distinct",()=>{const projection=buildExecutiveBusinessHealth(input());expect(projection).toMatchObject({score:60,status:"watch"});expect(projection.confidence).toMatchObject({score:70,availablePillars:2,totalPillars:7,coverage:2/7});expect(projection.pillars.investment.score).toBeNull();expect(projection.pillars.investment.limitations[0]).toContain("No canonical investment")});
  it("ranks attention deterministically and retains evidence destinations",()=>{const one=buildExecutiveBusinessHealth(input()),two=buildExecutiveBusinessHealth(input());expect(one.id).toBe(two.id);expect(one.attention.map(item=>item.id)).toEqual(two.attention.map(item=>item.id));expect(one.attention[0]).toMatchObject({kind:"risk",pillar:"financial",destination:"/dashboard/financial",rank:1});expect(one.recommendations[0].evidenceIds).toEqual(["financial-1"])});
  it("does not reduce health scores when evidence is missing",()=>{const projection=buildExecutiveBusinessHealth({...input(),pillars:[input().pillars[1]!]});expect(projection.score).toBe(80);expect(projection.confidence.coverage).toBe(1/7);expect(projection.confidence.limitations).toHaveLength(6)});
  it("rejects duplicate pillar inputs",()=>expect(()=>buildExecutiveBusinessHealth({...input(),pillars:[input().pillars[0]!,input().pillars[0]!]})).toThrow("DUPLICATE_EXECUTIVE_HEALTH_PILLAR"));
});
