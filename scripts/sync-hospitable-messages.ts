import { syncHospitableMessages } from "../src/features/integrations/hospitable";

async function main(){
  const batchSize=Number(process.env.HOSPITABLE_SYNC_BATCH_SIZE??"5");
  console.log("Starting Hospitable message backfill...");
  const result=await syncHospitableMessages({batchSize,mode:"manual"});
  console.log(JSON.stringify(result,null,2));
  if(result.failed>0)process.exitCode=1;
}

main().catch((error:unknown)=>{
  console.error(error instanceof Error?error.message:error);
  process.exit(1);
});
