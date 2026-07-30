import { redirect } from "next/navigation";

export default function InvestmentReportsPage() {
  redirect("/dashboard/reports?type=investment-decision");
}
