import{afterEach,describe,expect,it,vi}from"vitest";
import{sendHospitableReservationMessage}from"./messages";
describe("Hospitable messaging adapter",()=>{
  afterEach(()=>{vi.unstubAllGlobals();delete process.env.HOSPITABLE_API_TOKEN;delete process.env.HOSPITABLE_API_BASE_URL;});
  it("sends through the reservation conversation endpoint without leaking provider concerns",async()=>{
    process.env.HOSPITABLE_API_TOKEN="test-token";process.env.HOSPITABLE_API_BASE_URL="https://provider.example/v2";
    const request=vi.fn(async()=>new Response(JSON.stringify({data:{id:"provider-message-1",status:"sent"}}),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",request);
    await expect(sendHospitableReservationMessage({reservationId:"reservation/1",body:"Welcome"})).resolves.toEqual({providerMessageId:"provider-message-1",status:"sent"});
    expect(request).toHaveBeenCalledWith(new URL("https://provider.example/v2/reservations/reservation%2F1/messages"),expect.objectContaining({method:"POST",body:JSON.stringify({message:"Welcome"})}));
  });
  it("rejects unsafe provider responses",async()=>{process.env.HOSPITABLE_API_TOKEN="test-token";vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({data:{}}),{status:200})));await expect(sendHospitableReservationMessage({reservationId:"reservation-1",body:"Hello"})).rejects.toThrow("provider_invalid_response");});
});
