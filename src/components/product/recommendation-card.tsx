import type { ReactNode } from "react";
import { Badge } from "@/components/primitives";
import { Card, CardActions, CardContent, CardHeader } from "@/components/patterns/card";

export function RecommendationCard({ title, recommendation, rationale, priority = "medium", evidence, actions }: Readonly<{ title: string; recommendation: string; rationale: string; priority?: "low" | "medium" | "high"; evidence?: ReactNode; actions?: ReactNode }>) {
  const tone = priority === "high" ? "danger" : priority === "medium" ? "warning" : "neutral";
  return <Card><CardHeader title={title} accessory={<Badge tone={tone}>{priority} priority</Badge>} /><CardContent><p className="text-sm font-semibold leading-6 text-stone-900">{recommendation}</p><p className="mt-2 text-sm leading-6 text-stone-600">{rationale}</p>{evidence ? <div className="mt-5 border-t border-stone-100 pt-4">{evidence}</div> : null}</CardContent>{actions ? <CardActions>{actions}</CardActions> : null}</Card>;
}
