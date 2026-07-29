import type { HpmPillar } from "@/features/hpm";

export type ExecutiveEvidenceReference=Readonly<{
  capability:"market"|"financial"|"investment"|"revenue"|"operations"|"guest"|"learning";
  artifactType:string;artifactId:string;period:Readonly<{from:string;to:string}>;
  confidence:number;destination:string;summary:string;
}>;
export type ExecutivePillarProjection=Readonly<{
  pillar:HpmPillar;score:number|null;confidence:number|null;status:"healthy"|"watch"|"critical"|"unavailable";
  question:string;evidence:readonly ExecutiveEvidenceReference[];limitations:readonly string[];
  risks:readonly string[];opportunities:readonly string[];recommendation:string|null;
}>;
export type ExecutiveRecommendation=Readonly<{
  id:string;pillar:HpmPillar;title:string;whyItMatters:string;suggestedNextAction:string;
  confidence:number|null;businessImpact:number;destination:string;evidenceIds:readonly string[];
}>;
export type ExecutiveHealthAttentionItem=Readonly<{
  id:string;rank:number;kind:"risk"|"opportunity"|"unknown";pillar:HpmPillar;title:string;why:string;
  urgency:"critical"|"high"|"medium"|"low";impact:number;confidence:number|null;timeSensitivity:number;
  businessValue:number;attentionScore:number;destination:string|null;evidenceIds:readonly string[];
}>;
export type ExecutiveHealthTimelineItem=Readonly<{
  id:string;occurredAt:string;type:"health"|"confidence"|"risk"|"revenue"|"capital"|"learning";
  title:string;summary:string;pillar:HpmPillar;evidenceIds:readonly string[];destination:string|null;
}>;
export type ExecutiveConfidenceBreakdown=Readonly<{
  score:number|null;coverage:number;availablePillars:number;totalPillars:number;
  byPillar:Readonly<Record<HpmPillar,number|null>>;limitations:readonly string[];
}>;
export type ExecutiveBusinessHealthProjection=Readonly<{
  id:string;schemaVersion:"executive-business-health.v1";workspaceId:string;
  period:Readonly<{from:string;to:string}>;generatedAt:string;
  score:number|null;status:"excellent"|"healthy"|"watch"|"needs-attention"|"critical"|"unavailable";
  pillars:Readonly<Record<HpmPillar,ExecutivePillarProjection>>;
  confidence:ExecutiveConfidenceBreakdown;attention:readonly ExecutiveHealthAttentionItem[];
  recommendations:readonly ExecutiveRecommendation[];timeline:readonly ExecutiveHealthTimelineItem[];
  evidence:readonly ExecutiveEvidenceReference[];lineage:Readonly<{artifactIds:readonly string[];calculationVersion:"executive-health.v1"}>;
}>;
