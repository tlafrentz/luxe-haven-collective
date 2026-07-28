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
  it("retrieves every provider page and retries a rate-limited page",async()=>{
    process.env.HOSPITABLE_API_TOKEN="test-token";process.env.HOSPITABLE_API_BASE_URL="https://provider.example/v2";
    const request=vi.fn()
      .mockResolvedValueOnce(new Response("rate limited",{status:429,headers:{"Retry-After":"0"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:"message-1"}],links:{next:"https://provider.example/v2/reservations/reservation-1/messages?page=2"},meta:{current_page:1,last_page:2}}),{status:200,headers:{"Content-Type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:"message-2"}],links:{next:null},meta:{current_page:2,last_page:2}}),{status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",request);
    const sleep=vi.fn(async()=>undefined);
    await expect(getHospitableReservationMessages("reservation-1",{sleep})).resolves.toEqual([{id:"message-1"},{id:"message-2"}]);
    expect(sleep).toHaveBeenCalledWith(0,undefined);
    expect(request.mock.calls[2][0]).toEqual(new URL("https://provider.example/v2/reservations/reservation-1/messages?page=2"));
  });
  it("normalizes guest and host messages with stable provider identities",()=>{
    expect(normalizeHospitableMessage({sent_reference_id:"guest-1",body:" Need towels ",sender_type:"guest",sender:{full_name:"Jin Kim"},platform:"airbnb",created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1",ingestedAt:"2026-07-27T00:00:00Z"})).toMatchObject({providerMessageId:"guest-1",body:" Need towels ",occurredAt:"2026-07-26T12:00:00.000Z",direction:"inbound",senderType:"guest",senderDisplayName:"Jin Kim",platform:"airbnb",providerReservationId:"reservation-1"});
    expect(normalizeHospitableMessage({id:"provider-native-42",platform:"vrbo",platform_id:42,body:"On the way",sender_role:"host",user:{name:"Todd"},created_at:"2026-07-26T12:01:00Z"},{reservationId:"reservation-1"})).toMatchObject({providerMessageId:"provider-native-42",platformMessageId:"42",direction:"outbound",senderType:"operator",senderDisplayName:"Todd"});
  });
  it("normalizes numeric provider identifiers",()=>{
    expect(normalizeHospitableMessage({id:12345,reservation_id:67890,body:"Hello",created_at:"2026-07-26T12:00:00Z"},{reservationId:"67890"})).toMatchObject({providerMessageId:"12345",providerReservationId:"67890"});
  });
  it("rejects non-scalar provider identifiers",()=>{
    expect(normalizeHospitableMessage({id:{value:"message-1"},body:"Hello",created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1"})).toBeNull();
  });
  it("falls back when the primary identifier is invalid",()=>{
    expect(normalizeHospitableMessage({id:{},sent_reference_id:12345,body:"Hello",created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1"})).toMatchObject({providerMessageId:"12345"});
  });
  it("rejects messages that cannot be persisted safely",()=>{
    expect(normalizeHospitableMessage({body:"Missing identity",created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1"})).toBeNull();
    expect(normalizeHospitableMessage({sent_reference_id:"message-1",body:"Hello",created_at:"not-a-date"},{reservationId:"reservation-1"})).toBeNull();
    expect(normalizeHospitableMessage({id:"message-1",reservation_id:"other",body:"Hello",created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1"})).toBeNull();
  });
  it("preserves empty bodies, attachment metadata, system senders, and unknown senders explicitly",()=>{
    expect(normalizeHospitableMessage({id:"system-1",body:null,source:"automated",attachments:[{id:"file-1",filename:"arrival.pdf",mime_type:"application/pdf",url:"https://provider.example/file"}],created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1"})).toMatchObject({body:"",senderType:"system",direction:"system-event",attachments:[{providerAttachmentId:"file-1",filename:"arrival.pdf",mimeType:"application/pdf"}]});
    expect(normalizeHospitableMessage({id:"unknown-1",body:"Provider event",sender_type:"other",created_at:"2026-07-26T12:00:00Z"},{reservationId:"reservation-1"})).toMatchObject({senderType:"unknown",direction:"unknown",senderDisplayName:"Unknown sender"});
  });
});
