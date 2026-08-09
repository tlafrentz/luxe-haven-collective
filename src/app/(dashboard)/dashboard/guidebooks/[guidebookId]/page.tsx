import Link from "next/link";
import {notFound} from "next/navigation";
import {getGuidebookEditorRequest} from "@/app/actions/guidebook-studio";
import {archiveGuidebookAction,listGuidebookDraftMediaAction,loadGuidebookAuthoringAction} from "@/app/actions/guidebook-authoring";
import {listGuidebookChangeRequestsAction} from "@/app/actions/guidebook-change-requests";
import {getApprovalReviewAction} from "@/app/actions/guidebook-approval-review";
import {GuidebookAuthoringWorkspace} from "@/components/guidebooks/guidebook-authoring-workspace";
import {GuidebookApprovalReviewPanel} from "@/components/guidebooks/guidebook-approval-review-panel";
import {GuidebookChangeRequestPanel} from "@/components/guidebooks/guidebook-change-request-panel";
import {GuidebookVersionHistory} from "@/components/guidebooks/guidebook-version-history";
import {GuidebookNavigation} from "@/components/guidebooks/guidebook-navigation";
import {GuidebookPublicationControl} from "@/components/guidebooks/guidebook-publication-control";
import {buildMediaDimensionMap} from "@/features/guidebook-studio";

export default async function GuidebookEditorPage({params}:{params:Promise<{guidebookId:string}>}){
 const{id:guidebookId}={id:(await params).guidebookId},result=await getGuidebookEditorRequest(guidebookId);
 if(!result.ok){if(result.code==="guidebook_not_found")notFound();return <main className="mx-auto max-w-3xl py-10"><h1 className="text-xl font-semibold">Guidebook unavailable</h1><p className="mt-2 text-sm text-stone-600">The guidebook may have been removed, your permission may have changed, or property context is temporarily unavailable.</p><Link href="/dashboard/guidebooks" className="mt-4 inline-block rounded-full border px-4 py-2 text-sm font-semibold">Return to Guidebook Studio</Link></main>}
 const canEdit=result.permissions.manage&&result.guidebook.status!=="archived",managed=result.guidebook.authoring_mode==="managed";
 const authoring=managed?null:await loadGuidebookAuthoringAction({workspaceId:String(result.guidebook.workspace_id),guidebookId});
 const changeRequests=managed?await listGuidebookChangeRequestsAction(guidebookId):[];
 const approvalReview=await getApprovalReviewAction(guidebookId);
 const pendingApproval=approvalReview.request?.status==="pending"?approvalReview.request:null;
 const mediaDimensions=authoring&&authoring.ok?buildMediaDimensionMap(await listGuidebookDraftMediaAction({workspaceId:String(result.guidebook.workspace_id),guidebookId})):{};
 return <main className="mx-auto max-w-[96rem] space-y-6 py-8">
  <header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/dashboard/guidebooks" className="text-sm font-semibold text-amber-800">← Guidebook Studio</Link><p className="mt-4 text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Experience composer · {result.guidebook.status}</p><h1 className="mt-2 text-4xl font-semibold">{result.guidebook.title}</h1><p className="mt-2 text-stone-600">{result.property?.name} · Draft revision {result.guidebook.revision} · Published version {result.guidebook.current_version||"none"}</p></div><div className="flex flex-wrap gap-2"><Link href={`/dashboard/guidebooks/${guidebookId}/preview`} className="rounded-full border bg-white px-5 py-3 text-sm font-semibold">Full preview</Link>{result.guidebook.status==="published"?<Link href={`/g/${result.guidebook.public_slug}`} className="rounded-full border bg-white px-5 py-3 text-sm font-semibold">Open guest site</Link>:null}</div></header>
  <GuidebookNavigation guidebookId={guidebookId} current="content"/>
  <section className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-950"><strong>Draft workspace:</strong> edits and autosaves update only the working draft. Guests continue seeing the immutable published version until you publish again.</section>
  {pendingApproval?<GuidebookApprovalReviewPanel guidebookId={guidebookId} workspaceId={String(result.guidebook.workspace_id)} request={pendingApproval} comments={approvalReview.comments}/>:null}
  {managed?<GuidebookChangeRequestPanel guidebookId={guidebookId} workspaceId={String(result.guidebook.workspace_id)} requests={changeRequests}/>:authoring&&authoring.ok?<><GuidebookAuthoringWorkspace initialDraft={authoring.draft} canEdit={canEdit&&authoring.canEdit}/><GuidebookPublicationControl draft={authoring.draft} canPublish={canEdit&&authoring.canEdit&&result.entitlements.publish&&result.entitlements.host} mediaDimensions={mediaDimensions}/></>:<section role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6"><h2 className="font-semibold">Durable draft unavailable</h2><p className="mt-2 text-sm">{authoring?.message} Published versions remain unchanged.</p></section>}
  <GuidebookVersionHistory guidebookId={guidebookId} workspaceId={String(result.guidebook.workspace_id)} revision={Number(result.guidebook.revision)} versions={result.historyVersions} timeline={result.timeline} deliveries={result.deliveries} canRestore={canEdit}/>
  <footer className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-5"><div><h2 className="font-semibold">Guidebook lifecycle</h2><p className="mt-1 text-sm text-stone-600">{result.versions.length} immutable version(s) remain available. Public URL: {String(result.guidebook.public_url_status??(result.guidebook.status==="published"?"active":"unavailable"))}.</p></div>{canEdit?<form action={archiveGuidebookAction}><input type="hidden" name="guidebookId" value={guidebookId}/><input type="hidden" name="workspaceId" value={String(result.guidebook.workspace_id)}/><input type="hidden" name="revision" value={Number(result.guidebook.revision)}/><button className="rounded-full border px-4 py-2 text-sm font-semibold">Archive guidebook</button></form>:<p className="text-sm text-stone-500">Archived guidebooks retain published history and activity.</p>}</footer>
 </main>
}
