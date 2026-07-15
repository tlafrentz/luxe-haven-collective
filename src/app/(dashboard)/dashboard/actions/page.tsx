import {
  ACTION_CENTER_RECORDS,
  ActionCenter,
  buildActionCenterView,
} from "@/features/action-center";

export default function ActionCenterPage() {
  const view = buildActionCenterView(
    ACTION_CENTER_RECORDS,
  );

  return <ActionCenter view={view} />;
}
