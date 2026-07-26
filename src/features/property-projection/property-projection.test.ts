import {describe,expect,it} from "vitest";
import {buildCanonicalPropertyProjection,detectPropertyProjectionDrift,propertyProjectionSnapshot,propertyProjectionVariables,type PropertyProjectionSource} from ".";

const source:PropertyProjectionSource={id:"property-1",workspaceId:"workspace-1",name:"Lake House",slug:"lake-house",status:"active",address:"1 Lake Road",city:"Austin",state:"TX",timezone:"America/Chicago",checkInTime:"4 PM",checkoutTime:"10 AM",amenities:["Wi-Fi: LakeNet / secret","Parking: Use the west driveway","Door code: 2468","Emergency contact: 555-0100","Host phone: 555-0110","Trash: Tuesday curb pickup","Thermostat: Keep between 68 and 74"],houseRules:["No smoking"],featuredImage:"https://example.com/lake.jpg",updatedAt:"2026-07-26T12:00:00Z"};

describe("Canonical Property Projection",()=>{
 it("normalizes operational property facts behind a versioned read model",()=>{
  const projection=buildCanonicalPropertyProjection(source,"2026-07-26T12:01:00Z");
  expect(projection.projectionVersion).toBe("property-projection.v1");
  expect(projection.version).toMatch(/^ppv1-/);
  expect(projection.operational.wifi).toEqual({state:"available",value:"LakeNet / secret"});
  expect(projection.health).toMatchObject({status:"ready",publishable:true});
  expect(Object.isFrozen(projection.operational)).toBe(true);
 });
 it("produces a stable version for identical canonical source state",()=>{
  expect(buildCanonicalPropertyProjection(source,"2026-07-26T12:01:00Z").version).toBe(buildCanonicalPropertyProjection(source,"2026-07-26T13:01:00Z").version);
 });
 it("binds guidebook variables directly to the projection",()=>{
  const variables=propertyProjectionVariables(buildCanonicalPropertyProjection(source),"/g/lake");
  expect(variables).toMatchObject({propertyName:"Lake House",wifi:"LakeNet / secret",parking:"Use the west driveway",checkInTime:"4 PM",checkOutTime:"10 AM"});
 });
 it("blocks readiness and supplies recovery when required operations are missing",()=>{
  const projection=buildCanonicalPropertyProjection({...source,amenities:[]});
  expect(projection.health.publishable).toBe(false);
  expect(projection.health.missing).toEqual(expect.arrayContaining(["wifi","parking","emergencyContact"]));
  expect(projection.operational.wifi).toMatchObject({state:"missing",recovery:"Update property amenities"});
 });
 it("captures immutable resolved values and provenance for publication",()=>{
  const snapshot=propertyProjectionSnapshot(buildCanonicalPropertyProjection(source));
  expect(snapshot).toMatchObject({projectionId:"property:property-1",projectionVersion:"property-projection.v1",source:"property-domain",resolvedValues:{wifi:"LakeNet / secret"}});
  expect(Object.isFrozen(snapshot.resolvedValues)).toBe(true);
 });
 it("identifies exact guest-facing fields changed since publication",()=>{
  const original=buildCanonicalPropertyProjection(source),published=propertyProjectionSnapshot(original),current=buildCanonicalPropertyProjection({...source,amenities:source.amenities?.map(item=>item.startsWith("Wi-Fi:")?"Wi-Fi: NewNetwork":item)??[],updatedAt:"2026-07-27T12:00:00Z"});
  const drift=detectPropertyProjectionDrift(current,published);
  expect(drift.status).toBe("changed");
  expect(drift.changedFields.map(field=>field.key)).toEqual(["wifi"]);
  expect(drift.reviewRecommended).toBe(true);
 });
});
