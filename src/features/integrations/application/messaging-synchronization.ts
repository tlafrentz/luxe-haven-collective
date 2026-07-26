import type{MessagingProviderAdapter,ProviderSyncCommand,ProviderSyncResult}from"../domain/messaging-provider";
export type MessagingSyncRecord=Readonly<{id:string;providerId:string;workspaceId:string;connectionId:string;mode:ProviderSyncCommand["mode"];status:"running"|"completed"|"failed"|"partial";startedAt:string;completedAt?:string;cursor?:string;processed:number;created:number;updated:number;failed:number;safeError?:string}>;
export interface MessagingSyncRepository{start(record:MessagingSyncRecord):Promise<void>;complete(record:MessagingSyncRecord):Promise<void>;}
export async function executeMessagingSynchronization(input:Readonly<{adapter:MessagingProviderAdapter;repository:MessagingSyncRepository;command:ProviderSyncCommand;syncId:string;now?:()=>Date}>):Promise<ProviderSyncResult>{
 const clock=input.now??(()=>new Date()),startedAt=clock().toISOString(),base:MessagingSyncRecord={id:input.syncId,providerId:input.adapter.id,workspaceId:input.command.workspaceId,connectionId:input.command.connectionId,mode:input.command.mode,status:"running",startedAt,...(input.command.cursor?{cursor:input.command.cursor}:{}),processed:0,created:0,updated:0,failed:0};
 await input.repository.start(base);
 try{const result=await input.adapter.synchronize(input.command);await input.repository.complete({...base,status:result.failed>0?"partial":"completed",completedAt:result.completedAt,...(result.cursor?{cursor:result.cursor}:{}),processed:result.processed,created:result.created,updated:result.updated,failed:result.failed});return result;}
 catch(error){await input.repository.complete({...base,status:"failed",completedAt:clock().toISOString(),failed:1,safeError:"Provider synchronization failed. Existing conversations remain available."});throw error;}
}
