import Link from "next/link";
import { Eye, FileText, Plus } from "lucide-react";
import { getExecutiveReportWorkspace } from "@/app/actions/reporting";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const model = await getExecutiveReportWorkspace(workspace);
  if (!model) return <main className="mx-auto max-w-3xl px-5 py-16"><p role="alert">Sign in to view reports.</p></main>;
  const recentThreshold = new Date(model.evaluatedAt).getTime() - 30 * 24 * 60 * 60 * 1000;
  const metrics = [
    ["Scheduled", model.jobs.filter(job=>job.status !== "failed").length, "Upcoming"],
    ["Recent", model.reports.filter(report=>new Date(report.generated_at).getTime() >= recentThreshold).length, "Last 30 days"],
    ["Drafts", model.reports.filter(report=>report.status === "draft").length, "In progress"],
    ["Shared", model.reports.filter(report=>report.report_shares?.some(share=>share.status === "active")).length, "Active shares"],
  ] as const;
  const templates = [
    ["Monthly Executive Report","Performance summary for executives","violet","/dashboard/reports/executive/executive-performance-summary"],
    ["Owner Statement","Traceable operational owner balance statement","orange","/dashboard/reports/owner/owner-statement"],
    ["Investment Review","Acquisition underwriting and decision analysis","green","/dashboard/reports/investment/acquisition-underwriting"],
    ["Weekly Operations Summary","Operational execution and exceptions","teal","/dashboard/reports/operations/weekly-operations-summary"],
    ["Custom Report","Governed report builder availability","stone","/dashboard/reports/custom/custom-report-builder"],
  ] as const;
  return <main className="hpm-page">
    <header className="hpm-title"><div><h1>Hospitality Performance Reports</h1><p>Create and share business reports for every audience.</p></div><Link className="hpm-button" href="/dashboard/reports/new?type=property-performance">Create report <Plus/></Link></header>
    <nav className="hpm-tabs" aria-label="Report views"><Link className="active" href="/dashboard/reports/executive">Executive</Link><Link href="/dashboard/reports/owner">Owner</Link><Link href="/dashboard/reports/investment">Investment</Link><Link href="/dashboard/reports/operations">Operations</Link><Link href="/dashboard/reports/custom">Custom</Link></nav>
    <div className="hpm-reports-layout"><div className="hpm-reports-main">
      <section className="hpm-metrics four" aria-label="Report summary">{metrics.map(([label,value,detail])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</section>
      <section className="hpm-panel"><div className="hpm-panel-head"><h2>Recent Reports</h2></div>{model.reports.length?<div className="overflow-x-auto"><table className="hpm-table hpm-reports-table"><thead><tr><th>Report</th><th>Type</th><th>Status</th><th>Generated</th><th>Open</th></tr></thead><tbody>{model.reports.slice(0,8).map(report=><tr key={report.id}><td>{report.title}</td><td><span className="hpm-report-tag operations">{report.report_type.replaceAll("-"," ")}</span></td><td><span className={`hpm-report-status ${report.status}`}>{report.status}</span></td><td>{new Date(report.generated_at).toLocaleString()}</td><td><Link aria-label={`View ${report.title}`} href={`/dashboard/reports/${report.id}`}><Eye className="h-3 w-3"/></Link></td></tr>)}</tbody></table></div>:<p className="rounded-xl bg-stone-50 p-5 text-sm text-stone-600">No generated reports exist in this workspace.</p>}<Link className="hpm-reports-link" href="/dashboard/reports/executive">View report workspace <Plus/></Link></section>
    </div><section className="hpm-panel"><div className="hpm-panel-head"><h2>Report Templates</h2></div><div className="hpm-report-templates">{templates.map(([name,description,tone,href])=><Link href={href} key={name}><span className={`hpm-template-icon ${tone}`}><FileText/></span><span><strong>{name}</strong><small>{description}</small></span></Link>)}</div></section></div>
  </main>;
}
