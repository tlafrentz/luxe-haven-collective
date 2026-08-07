export const MESA_CERTIFICATION_CHECKS = [
  "customer_create_property",
  "customer_create_guidebook",
  "admin_workspace_parity",
  "all_reference_sections_authored",
  "canonical_content_bindings",
  "canonical_media_bindings",
  "canonical_property_variables",
  "desktop_preview",
  "tablet_preview",
  "mobile_preview",
  "snapshot_web_delivery",
  "snapshot_pdf_delivery",
  "snapshot_qr_delivery",
  "guest_stay_route",
  "publish_version_one",
  "edit_after_publish",
  "publish_version_two",
  "version_one_preserved",
  "guest_receives_version_two",
  "keyboard_accessibility",
  "authorization_isolation",
] as const;

export type MesaCertificationCheck=(typeof MESA_CERTIFICATION_CHECKS)[number];
export type MesaCertificationEvidence=Readonly<{check:MesaCertificationCheck;passed:boolean;evidence:string}>;
export type MesaCertificationResult=Readonly<{status:"certified"|"not-certified";passed:number;total:number;missing:readonly MesaCertificationCheck[];failed:readonly MesaCertificationEvidence[]}>;

export function evaluateMesaProductionCertification(evidence:readonly MesaCertificationEvidence[]):MesaCertificationResult{
  const byCheck=new Map(evidence.map(item=>[item.check,item]));
  const missing=MESA_CERTIFICATION_CHECKS.filter(check=>!byCheck.has(check));
  const failed=evidence.filter(item=>!item.passed);
  const passed=MESA_CERTIFICATION_CHECKS.filter(check=>byCheck.get(check)?.passed===true).length;
  return Object.freeze({status:missing.length||failed.length?"not-certified":"certified",passed,total:MESA_CERTIFICATION_CHECKS.length,missing:Object.freeze(missing),failed:Object.freeze(failed)});
}
