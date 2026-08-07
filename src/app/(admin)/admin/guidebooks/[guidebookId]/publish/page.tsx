import {notFound} from "next/navigation";
import {getGuidebookEditorRequest} from "@/app/actions/guidebook-studio";
import {loadGuidebookAuthoringAction} from "@/app/actions/guidebook-authoring";
import {GuidebookPublishWorkspace} from "@/components/guidebooks/guidebook-publish-workspace";
export default async function Page({params}:{params:Promise<{guidebookId:string}>}){const{guidebookId}=await params,result=await getGuidebookEditorRequest(guidebookId);if(!result.ok)notFound();const authoring=await loadGuidebookAuthoringAction({workspaceId:String(result.guidebook.workspace_id),guidebookId});if(!authoring.ok)notFound();return <GuidebookPublishWorkspace draft={authoring.draft} propertyName={result.property?.name??"Property"} publicSlug={String(result.guidebook.public_slug)} status={String(result.guidebook.status)} canPublish={authoring.canEdit&&result.entitlements.publish&&result.entitlements.host} basePath="/admin/guidebooks"/>}
