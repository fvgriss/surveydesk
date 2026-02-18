/**
 * Extracts structured info from a Retell AI call summary.
 *
 * Retell summaries follow patterns like:
 *   "The user, Delilah Grissom, called to request a quote for a
 *    boundary survey at 112 Robert Street, providing her contact
 *    details and expressing urgency for the survey to be done next week."
 *
 *   "The user, Antonio Fares, called Griss Land Surveying to inquire
 *    about getting a boundary survey for his home at 7219 East Navarro..."
 */

export interface ParsedCallSummary {
  callerName: string | null;
  firstName: string | null;
  lastName: string | null;
  propertyAddress: string | null;
  surveyType: string | null;
  timeline: string | null;
  email: string | null;
}

const SURVEY_TYPE_MAP: Record<string, string> = {
  boundary: "boundary",
  alta: "alta",
  "alta/nsps": "alta",
  topographic: "topographic",
  topo: "topographic",
  "as-built": "as_built",
  "as built": "as_built",
  subdivision: "subdivision",
  construction: "construction",
  "elevation certificate": "elevation_cert",
  "elevation cert": "elevation_cert",
  route: "route",
};

export function parseCallSummary(
  summary: string | null,
  transcript: string | null
): ParsedCallSummary {
  const result: ParsedCallSummary = {
    callerName: null,
    firstName: null,
    lastName: null,
    propertyAddress: null,
    surveyType: null,
    timeline: null,
    email: null,
  };

  const text = summary || "";
  const fullText = `${text} ${transcript || ""}`;

  // --- Extract caller name ---
  // Pattern: "The user, John Smith, called..."
  // Pattern: "The caller, John Smith, called..."
  const nameMatch = text.match(
    /(?:The\s+(?:user|caller|customer|client)),?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}),?\s+(?:called|contacted|phoned|reached out)/i
  );
  if (nameMatch) {
    result.callerName = nameMatch[1].trim();
    const parts = result.callerName.split(/\s+/);
    result.firstName = parts[0];
    result.lastName = parts.slice(1).join(" ") || null;
  }

  // Also check transcript for "My name is ..."
  if (!result.callerName) {
    const transcriptNameMatch = fullText.match(
      /[Mm]y name is ([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/
    );
    if (transcriptNameMatch) {
      result.callerName = transcriptNameMatch[1].trim();
      const parts = result.callerName.split(/\s+/);
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(" ") || null;
    }
  }

  // --- Extract property address ---
  // Pattern: "survey at 123 Main Street" / "property at 123 Main St"
  // Pattern: "survey on their property at 123 Main St"
  // Pattern: "survey for his home at 123 Main St"
  const addressPatterns = [
    /(?:survey|quote|work)\s+(?:at|on|for)\s+(?:their\s+(?:property|home|lot|land)\s+(?:at|on)\s+)?(\d+\s+[A-Za-z0-9\s,.']+?)(?:\.|,\s+(?:providing|expressing|and\s+)|$)/i,
    /(?:property|home|lot|land|address)\s+(?:at|on|is)\s+(\d+\s+[A-Za-z0-9\s,.']+?)(?:\.|,\s+(?:providing|expressing|and\s+)|$)/i,
    /(?:at|on)\s+(\d+\s+[A-Z][A-Za-z0-9\s,.']+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)[A-Za-z0-9\s,.]*?)(?:\.|,\s+(?:providing|expressing|The)|$)/i,
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      let addr = match[1].trim();
      // Clean trailing conjunctions/words
      addr = addr.replace(/\s+(?:and|providing|expressing|the|she|he|they)$/i, "").trim();
      // Remove trailing periods or commas
      addr = addr.replace(/[.,]+$/, "").trim();
      if (addr.length > 5 && /\d/.test(addr)) {
        result.propertyAddress = addr;
        break;
      }
    }
  }

  // --- Extract survey type ---
  const surveyTypeMatch = text.match(
    /(?:a|an|the)\s+(boundary|alta(?:\/nsps)?|topographic|topo|as[- ]built|subdivision|construction|elevation\s+cert(?:ificate)?|route)\s+survey/i
  );
  if (surveyTypeMatch) {
    const raw = surveyTypeMatch[1].toLowerCase();
    result.surveyType = SURVEY_TYPE_MAP[raw] || "boundary";
  }

  // --- Extract timeline / urgency ---
  const timelinePatterns = [
    /(?:urgency|urgent|timeline|needed|wanted|done|completed|finished|scheduled)\s+(?:for\s+|by\s+|within\s+|to\s+be\s+(?:done|completed)\s+)?(.+?)(?:\.|$)/i,
    /(?:as soon as possible|asap|right away|immediately|next week|this week|within\s+\w+\s+(?:days?|weeks?)|by\s+\w+|rush|expedite)/i,
    /(?:wants?|needs?|would like)\s+(?:it|the survey|this)\s+(?:done|completed|finished)\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of timelinePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.timeline = match[0].trim().replace(/\.$/, "");
      break;
    }
  }

  // --- Extract email ---
  // Check transcript for spelled-out emails like "dance s griss at g mail dot com"
  const emailDirect = fullText.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  if (emailDirect) {
    result.email = emailDirect[0];
  }

  // Also try spelled-out pattern: "X at Y dot com"
  if (!result.email) {
    const spelledEmail = fullText.match(
      /(?:email\s+is\s+)([a-z0-9\s]+)\s+at\s+([a-z0-9\s]+)\s+dot\s+com/i
    );
    if (spelledEmail) {
      const local = spelledEmail[1].trim().replace(/\s+/g, "");
      const domain = spelledEmail[2].trim().replace(/\s+/g, "");
      result.email = `${local}@${domain}.com`;
    }
  }

  return result;
}
