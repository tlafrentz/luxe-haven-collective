import {
  ACTION_CENTER_RECORDS,
  ActionCenter,
  buildActionCenterView,
} from "@/features/action-center";

export default function ActionCenterPage() {
  return (
    <ActionCenter
      view={buildActionCenterView(ACTION_CENTER_RECORDS)}
    />
  );
}
