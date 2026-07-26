import {describe,expect,it} from "vitest";
import {PropertyProjectionGateway,PropertyProjectionGatewayError,type PropertyProjectionSource} from ".";

const source:PropertyProjectionSource={id:"property-1",workspaceId:"workspace-1",name:"House",status:"active",updatedAt:"2026-07-26T12:00:00Z"};
describe("Property Projection Gateway",()=>{
 it("returns the canonical contract for authorized consumers",async()=>expect((await new PropertyProjectionGateway({findProperty:async()=>source},{canView:()=>true}).get(source.id)).projectionVersion).toBe("property-projection.v1"));
 it("filters permission before loading source data",async()=>{let queried=false;const gateway=new PropertyProjectionGateway({findProperty:async()=>{queried=true;return source}},{canView:()=>false});await expect(gateway.get(source.id)).rejects.toMatchObject({code:"permission_denied"} satisfies Partial<PropertyProjectionGatewayError>);expect(queried).toBe(false)});
 it("distinguishes an unavailable property",async()=>await expect(new PropertyProjectionGateway({findProperty:async()=>null},{canView:()=>true}).get(source.id)).rejects.toMatchObject({code:"property_unavailable"}));
});
