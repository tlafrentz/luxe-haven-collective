import {describe,expect,it} from "vitest";
import {evaluateMesaProductionCertification,MESA_CERTIFICATION_CHECKS,type MesaCertificationEvidence} from "./application/mesa-production-certification";

describe("GS-V1D Mesa production certification gate",()=>{
  it("cannot certify partial evidence",()=>{const result=evaluateMesaProductionCertification([{check:"guest_stay_route",passed:true,evidence:"/stay/[slug] build route"}]);expect(result.status).toBe("not-certified");expect(result.missing).toContain("snapshot_pdf_delivery")});
  it("cannot certify a recorded channel failure",()=>{const evidence=MESA_CERTIFICATION_CHECKS.map(check=>({check,passed:check!=="snapshot_pdf_delivery",evidence:check==="snapshot_pdf_delivery"?"PDF renderer unavailable":"verified"})) satisfies MesaCertificationEvidence[];const result=evaluateMesaProductionCertification(evidence);expect(result.status).toBe("not-certified");expect(result.failed.map(item=>item.check)).toEqual(["snapshot_pdf_delivery"])});
  it("certifies only complete passing evidence",()=>{const evidence=MESA_CERTIFICATION_CHECKS.map(check=>({check,passed:true,evidence:`verified:${check}`})) satisfies MesaCertificationEvidence[];expect(evaluateMesaProductionCertification(evidence)).toMatchObject({status:"certified",passed:MESA_CERTIFICATION_CHECKS.length,total:MESA_CERTIFICATION_CHECKS.length,missing:[],failed:[]})});
});
