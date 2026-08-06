import {describe,expect,it} from "vitest";
import {createMesaImportProposals,MESA_GUIDEBOOK_IMPORT_MAPPING} from "./application/mesa-guidebook-mapping";
describe("Mesa canonical import mapping",()=>{
 it("maps all 18 source pages into guest-journey sections",()=>{expect(MESA_GUIDEBOOK_IMPORT_MAPPING).toHaveLength(18);expect(MESA_GUIDEBOOK_IMPORT_MAPPING.map(item=>item.kind)).toEqual(["welcome","property_overview","arrival","wifi","house_rules","appliances","faq","safety","emergency","transportation","things_to_do","restaurants","nightlife","shopping","departure","review_request","stay_connected","thank_you"])});
 it("creates review-required proposals and never an accepted or published result",()=>{const proposals=createMesaImportProposals("import-1");expect(proposals.length).toBeGreaterThan(18);expect(proposals.every(item=>item.reviewStatus==="pending")).toBe(true);expect(proposals.some(item=>item.proposedEntityType==="section")).toBe(true);expect(proposals.some(item=>item.proposedEntityType==="component")).toBe(true)});
});
