import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface ClassifyEmailInput {
  subject: string;
  bodyPreview: string;
  bodyFull: string;
  fromEmail: string;
  fromName: string;
  activeProjects: Array<{
    id: string;
    propertyAddress: string;
    surveyType: string;
    contactEmail?: string | null;
    contactName?: string | null;
  }>;
}

export interface ClassifyEmailResult {
  suggestedAction: "create_lead" | "assign_project" | "dismiss";
  classification: "survey_request" | "project_update" | "general_inquiry" | "spam" | "not_relevant";
  extractedAddress?: string;
  extractedSurveyType?: string;
  extractedContactName?: string;
  extractedContactPhone?: string;
  extractedUrgency?: "low" | "medium" | "high";
  matchedProjectId?: string;
  matchedProjectAddress?: string;
  confidence: number;
  reasoning?: string;
}

const SYSTEM_PROMPT = `You are an email classifier for a land surveying firm. You analyze incoming emails and classify them.

Classifications:
- "survey_request": Someone requesting a land survey (boundary, ALTA, topographic, as-built, subdivision, construction, elevation certificate, route survey). They may mention a property address, lot, parcel, or specific survey type.
- "project_update": An email related to an existing project — could be a client follow-up, a title company sending documents, or someone asking about status. Match to an active project by address or sender email.
- "general_inquiry": A legitimate business inquiry that isn't a specific survey request (pricing questions, availability, general info).
- "spam": Marketing, newsletters, automated notifications, social media alerts, promotions.
- "not_relevant": Personal emails, internal memos, or anything not related to survey work.

Survey types to detect: boundary, alta, topographic, as_built, subdivision, construction, elevation_cert, route, other.

Urgency detection:
- "high": mentions rush, ASAP, closing date, deadline, urgent
- "medium": mentions timeline or preferred date
- "low": default

Return valid JSON matching this schema exactly:
{
  "classification": string,
  "suggestedAction": "create_lead" | "assign_project" | "dismiss",
  "extractedAddress": string | null,
  "extractedSurveyType": string | null,
  "extractedContactName": string | null,
  "extractedContactPhone": string | null,
  "extractedUrgency": "low" | "medium" | "high" | null,
  "matchedProjectId": string | null,
  "matchedProjectAddress": string | null,
  "confidence": number (0.0 to 1.0),
  "reasoning": string (one sentence)
}

Rules:
- For survey_request → suggestedAction = "create_lead"
- For project_update → suggestedAction = "assign_project" and include matchedProjectId
- For spam/not_relevant → suggestedAction = "dismiss"
- For general_inquiry → suggestedAction = "create_lead" (so the firm can follow up)
- Only return raw JSON, no markdown or explanation`;

export async function classifyEmail(
  input: ClassifyEmailInput
): Promise<ClassifyEmailResult | null> {
  try {
    // Build project context for matching
    const projectContext =
      input.activeProjects.length > 0
        ? `\n\nActive projects for matching:\n${input.activeProjects
            .map(
              (p) =>
                `- ID: ${p.id} | Address: ${p.propertyAddress} | Type: ${p.surveyType}${p.contactEmail ? ` | Contact: ${p.contactEmail}` : ""}${p.contactName ? ` (${p.contactName})` : ""}`
            )
            .join("\n")}`
        : "";

    const bodyText = (input.bodyFull || input.bodyPreview || "").slice(0, 2000);

    const userMessage = `Classify this email:

From: ${input.fromName} <${input.fromEmail}>
Subject: ${input.subject}

Body:
${bodyText}${projectContext}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const result = JSON.parse(text) as ClassifyEmailResult;

    // Validate required fields
    if (!result.classification || !result.suggestedAction || result.confidence == null) {
      console.error("[classify-email] Invalid response structure:", text);
      return null;
    }

    return result;
  } catch (err) {
    console.error("[classify-email] Classification failed:", err);
    return null;
  }
}
