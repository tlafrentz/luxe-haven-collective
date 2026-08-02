import LearningHealthPage from "./health/page";

export default function LearningPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  return <LearningHealthPage searchParams={searchParams} />;
}
