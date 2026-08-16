import { describe, expect, it } from "vitest";
import { diagnoseNanoStructuredResponse } from "./openai-responses";

const usage={input_tokens:20,output_tokens:10,input_tokens_details:{cached_tokens:4},output_tokens_details:{reasoning_tokens:6}};
const base={status:"completed",model:"gpt-5-nano",usage,output:[{type:"message",content:[{type:"output_text",text:'{"ok":true}'}]}]};
const diagnose=(body:unknown)=>diagnoseNanoStructuredResponse({body,httpStatus:200,openaiRequestId:"req_fixture",latencyMs:25,correlationId:"correlation"});

describe("sanitized OpenAI Responses fixtures",()=>{
  it("accepts a valid strict structured result",()=>{expect(diagnose(base)).toMatchObject({outcome:"completed_valid",jsonParseResult:"valid",usageExisted:true,inputTokens:20,cachedInputTokens:4,outputTokens:10,reasoningTokens:6,calculatedCostUsd:.00000482})});
  it("classifies malformed JSON while preserving usage",()=>{expect(diagnose({...base,output:[{type:"message",content:[{type:"output_text",text:"{"}]}]})).toMatchObject({outcome:"completed_invalid",classification:"OPENAI_MALFORMED_JSON",jsonParseResult:"malformed",inputTokens:20,outputTokens:10})});
  it("reports exact schema mismatch paths and expected types",()=>{expect(diagnose({...base,output:[{type:"message",content:[{type:"output_text",text:'{"ok":"yes"}'}]}]})).toMatchObject({outcome:"completed_invalid",classification:"OPENAI_SCHEMA_MISMATCH",schemaValidationErrors:[{path:"$.ok",expected:"boolean"}]})});
  it("distinguishes incomplete output from invalid JSON",()=>{expect(diagnose({...base,status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[]})).toMatchObject({outcome:"incomplete",classification:"OPENAI_RESPONSE_INCOMPLETE",incompleteReason:"max_output_tokens",jsonParseResult:"not_attempted"})});
  it("distinguishes refusal from invalid JSON",()=>{expect(diagnose({...base,output:[{type:"message",content:[{type:"refusal",refusal:"redacted"}]}]})).toMatchObject({outcome:"refusal",classification:"OPENAI_RESPONSE_REFUSED",refusalExisted:true,jsonParseResult:"not_attempted"})});
  it("preserves usage for completed application-invalid data",()=>{expect(diagnose({...base,output:[{type:"message",content:[{type:"output_text",text:'{"ok":true,"extra":1}'}]}]})).toMatchObject({outcome:"completed_invalid",usageExisted:true,inputTokens:20,reasoningTokens:6,schemaValidationErrors:[{path:"$",expected:"no additional properties"}]})});
  it("handles reasoning output followed by message output",()=>{expect(diagnose({...base,output:[{type:"reasoning",summary:[]},...base.output]})).toMatchObject({outcome:"completed_valid",outputItemTypes:["reasoning","message"],outputTextExisted:true})});
  it("classifies missing output_text without attempting JSON parsing",()=>{expect(diagnose({...base,output:[{type:"message",content:[]}]})).toMatchObject({outcome:"completed_invalid",classification:"OPENAI_OUTPUT_TEXT_MISSING",outputTextExisted:false,jsonParseResult:"not_attempted"})});
});
