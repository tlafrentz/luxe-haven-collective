import{afterEach,describe,expect,it,vi}from"vitest";
import{getHospitableReservationMessages,normalizeHospitableMessage,sendHospitableReservationMessage}from"./messages";
describe("Hospitable messaging adapter",()=>{
  afterEach(()=>{vi.unstubAllGlobals();delete process.env.HOSPITABLE_API_TOKEN;delete process.env.HOSPITABLE_API_BASE_URL;});
  it("sends through the reservation conversation endpoint without leaking provider concerns",async()=>{
    process.env.HOSPITABLE_API_TOKEN="test-token";process.env.HOSPITABLE_API_BASE_URL="https://provider.example/v2";
    const request=vi.fn(async()=>new Response(JSON.stringify({data:{id:"provider-message-1",status:"sent"}}),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",request);
    await expect(sendHospitableReservationMessage({reservationId:"reservation/1",body:"Welcome"})).resolves.toEqual({providerMessageId:"provider-message-1",status:"sent"});
    expect(request).toHaveBeenCalledWith(new URL("https://provider.example/v2/reservations/reservation%2F1/messages"),expect.objectContaining({method:"POST",body:JSON.stringify({message:"Welcome"})}));
  });
  it("rejects unsafe provider responses",async()=>{process.env.HOSPITABLE_API_TOKEN="test-token";vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({data:{}}),{status:200})));await expect(sendHospitableReservationMessage({reservationId:"reservation-1",body:"Hello"})).rejects.toThrow("provider_invalid_response");});
  it("retrieves a reservation message history",async()=>{
    process.env.HOSPITABLE_API_TOKEN="test-token";process.env.HOSPITABLE_API_BASE_URL="https://provider.example/v2";
    const request=vi.fn(async()=>new Response(JSON.stringify({data:[{sent_reference_id:"message-1",body:"Hello",sender_type:"guest",created_at:"2026-07-26T12:00:00Z"}]}),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",request);
    await expect(getHospitableReservationMessages("reservation/1")).resolves.toHaveLength(1);
    expect(request).toHaveBeenCalledWith(new URL("https://provider.example/v2/reservations/reservation%2F1/messages"),expect.objectContaining({method:"GET"}));
  });
  it("normalizes guest and host messages with stable provider identities",()=>{
    expect(normalizeHospitableMessage({sent_reference_id:"guest-1",body:" Need towels ",sender_type:"guest",sender:{full_name:"Jin Kim"},platform:"airbnb",created_at:"2026-07-26T12:00:00Z"})).toEqual({providerMessageId:"guest-1",body:"Need towels",occurredAt:"2026-07-26T12:00:00.000Z",direction:"inbound",senderType:"guest",senderDisplayName:"Jin Kim",platform:"airbnb"});
    expect(normalizeHospitableMessage({platform:"vrbo",platform_id:42,body:"On the way",sender_role:"host",user:{name:"Todd"},created_at:"2026-07-26T12:01:00Z"})).toMatchObject({providerMessageId:"vrbo:42",direction:"outbound",senderType:"operator",senderDisplayName:"Todd"});
  });
  it("rejects messages that cannot be persisted safely",()=>{
    expect(normalizeHospitableMessage({body:"Missing identity",created_at:"2026-07-26T12:00:00Z"})).toBeNull();
    expect(normalizeHospitableMessage({sent_reference_id:"message-1",body:"",created_at:"2026-07-26T12:00:00Z"})).toBeNull();
    expect(normalizeHospitableMessage({sent_reference_id:"message-1",body:"Hello",created_at:"not-a-date"})).toBeNull();
  });
});
