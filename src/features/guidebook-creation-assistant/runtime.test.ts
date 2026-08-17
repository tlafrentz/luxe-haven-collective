import{describe,expect,it,vi}from"vitest";
const{createAdmin,update,eq}=vi.hoisted(()=>({createAdmin:vi.fn(),update:vi.fn(),eq:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/supabase/admin",()=>({createAdminClient:createAdmin}));
import{processOneCreationWork}from"./runtime";
describe("controlled worker scope and lease recovery",()=>{
 it("releases a claimed wrong-job lease without provider contact",async()=>{eq.mockImplementation(()=>({eq}));update.mockImplementation(()=>({eq}));createAdmin.mockReturnValue({rpc:vi.fn().mockResolvedValue({data:[{id:"work-other",job_id:"job-other",idempotency_key:"work",attempts:1}],error:null}),from:vi.fn(()=>({update}))});await expect(processOneCreationWork("controlled-worker",{controlledVerification:true,expectedJobId:"job-expected"})).rejects.toThrow("CONTROLLED_WORK_ITEM_SCOPE_MISMATCH");expect(update).toHaveBeenCalledWith({status:"queued",lease_owner:null,lease_expires_at:null})});
});
