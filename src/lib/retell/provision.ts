import Retell from "retell-sdk";
import { getAgentPrompt } from "./agent-prompt-template";

/**
 * Common area codes by US state (one representative code per state).
 * Used to provision phone numbers with a local feel.
 */
const STATE_AREA_CODES: Record<string, string> = {
  AL: "205", AK: "907", AZ: "520", AR: "501", CA: "916",
  CO: "303", CT: "203", DE: "302", FL: "407", GA: "404",
  HI: "808", ID: "208", IL: "312", IN: "317", IA: "515",
  KS: "316", KY: "502", LA: "504", ME: "207", MD: "410",
  MA: "617", MI: "313", MN: "612", MS: "601", MO: "314",
  MT: "406", NE: "402", NV: "702", NH: "603", NJ: "201",
  NM: "505", NY: "212", NC: "919", ND: "701", OH: "614",
  OK: "405", OR: "503", PA: "215", RI: "401", SC: "843",
  SD: "605", TN: "615", TX: "512", UT: "801", VT: "802",
  VA: "804", WA: "206", WV: "304", WI: "414", WY: "307",
  DC: "202",
};

interface ProvisionResult {
  agentId: string;
  phoneNumber: string; // E.164 format, e.g. "+15205551234"
}

/**
 * Build the create_lead custom tool definition for Retell LLM.
 */
function getCreateLeadTool(appUrl: string) {
  return {
    type: "custom" as const,
    name: "create_lead",
    description:
      "Save a new lead from the caller. Call this once you have the property address and caller name.",
    speak_after_execution: true,
    url: `${appUrl}/api/retell/tool-call?fn=create_lead`,
    parameters: {
      type: "object" as const,
      properties: {
        caller_name: { type: "string", description: "Caller's full name" },
        caller_phone: { type: "string", description: "Caller's phone number" },
        caller_email: { type: "string", description: "Caller's email address" },
        company_name: {
          type: "string",
          description: "Company name if mentioned (title company, realtor, etc.)",
        },
        property_address: {
          type: "string",
          description: "Property address needing a survey",
        },
        survey_type: {
          type: "string",
          description:
            "Type of survey: boundary, alta, topographic, as_built, subdivision, construction, elevation_cert, route, or other",
        },
        urgency: {
          type: "string",
          description: "Urgency: high, medium, or low",
        },
        notes: { type: "string", description: "Additional context from the call" },
        special_requests: {
          type: "string",
          description: "Any special requirements",
        },
      },
      required: ["property_address", "caller_name"],
    },
  };
}

/**
 * Provision a new Retell agent + phone number for a tenant.
 *
 * Steps:
 * 1. Create a Retell LLM with the firm's intake prompt + tools
 * 2. Create a Retell agent attached to that LLM
 * 3. Buy a phone number matching the firm's state area code
 * 4. Return the agent ID and phone number
 */
export async function provisionRetellAgent(opts: {
  firmName: string;
  state?: string;
  tenantId: string;
}): Promise<ProvisionResult> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    throw new Error("RETELL_API_KEY is not configured");
  }

  const retell = new Retell({ apiKey });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app";

  // 1. Create the LLM with prompt + tools
  const agentPrompt = getAgentPrompt(opts.firmName);

  const llm = await retell.llm.create({
    general_prompt: agentPrompt,
    begin_message: `Hi, thanks for calling ${opts.firmName}! How can I help you today?`,
    general_tools: [
      getCreateLeadTool(appUrl),
      { type: "end_call" as const, name: "end_call", description: "End the call when the conversation is complete." },
    ],
  });

  const llmId = llm.llm_id;
  console.log(`[provision] Created LLM: ${llmId} for ${opts.firmName}`);

  // 2. Create the agent attached to the LLM
  const agent = await retell.agent.create({
    agent_name: `${opts.firmName} — SurveyDesk Intake`,
    response_engine: {
      type: "retell-llm",
      llm_id: llmId,
    },
    voice_id: "11labs-Adrian", // Natural male voice
    language: "en-US",
    webhook_url: `${appUrl}/api/retell/webhook`,
  });

  const agentId = agent.agent_id;
  console.log(`[provision] Created agent: ${agentId} for ${opts.firmName}`);

  // 3. Buy a phone number with area code matching their state
  const areaCode = opts.state ? STATE_AREA_CODES[opts.state] : undefined;

  const phoneNumber = await retell.phoneNumber.create({
    area_code: areaCode ? parseInt(areaCode) : undefined,
    inbound_agent_id: agentId,
    nickname: `${opts.firmName} intake`,
  });

  const number = phoneNumber.phone_number; // E.164 format
  console.log(
    `[provision] Provisioned number: ${number} (area code: ${areaCode || "default"}) for ${opts.firmName}`
  );

  return {
    agentId,
    phoneNumber: number,
  };
}
