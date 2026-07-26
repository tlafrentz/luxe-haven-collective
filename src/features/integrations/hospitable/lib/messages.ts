import { hospitableRequest } from "./client";

type HospitableMessageResponse=Readonly<{data?:Readonly<{id?:string;status?:string}>;id?:string;status?:string}>;

/** Provider adapter boundary for Hospitable's reservation conversation API. */
export async function sendHospitableReservationMessage(input:Readonly<{reservationId:string;body:string}>){
  const response=await hospitableRequest<HospitableMessageResponse>(`/reservations/${encodeURIComponent(input.reservationId)}/messages`,{method:"POST",body:{message:input.body}});
  const data=response.data??response,providerMessageId=data.id;
  if(!providerMessageId)throw new Error("provider_invalid_response");
  return Object.freeze({providerMessageId,status:data.status==="delivered"?"delivered"as const:"sent"as const});
}
