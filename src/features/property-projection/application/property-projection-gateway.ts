import {buildCanonicalPropertyProjection,type CanonicalPropertyProjection,type PropertyProjectionSource} from "../domain/property-projection";

export interface PropertyProjectionRepository{findProperty(propertyId:string):Promise<PropertyProjectionSource|null>}
export interface PropertyProjectionAuthorization{canView(propertyId:string):boolean}
export class PropertyProjectionGateway{
 constructor(private readonly repository:PropertyProjectionRepository,private readonly authorization:PropertyProjectionAuthorization){}
 async get(propertyId:string):Promise<CanonicalPropertyProjection>{
  if(!this.authorization.canView(propertyId))throw new PropertyProjectionGatewayError("permission_denied","You do not have access to this property.");
  const source=await this.repository.findProperty(propertyId);if(!source)throw new PropertyProjectionGatewayError("property_unavailable","The property projection is unavailable.");
  return buildCanonicalPropertyProjection(source);
 }
}
export class PropertyProjectionGatewayError extends Error{constructor(public readonly code:"permission_denied"|"property_unavailable",message:string){super(message);this.name="PropertyProjectionGatewayError";Object.freeze(this)}}
