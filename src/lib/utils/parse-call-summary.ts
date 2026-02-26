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
  urgency: "low" | "medium" | "high";
  email: string | null;
  phone: string | null;
  specialRequests: string | null;
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

/**
 * Strip conversational filler that the AI agent sometimes appends to
 * what should be a clean property address.
 *
 * "114 Robert Street and provided their contact details" → "114 Robert Street"
 * "113 Robert Street for next week"                      → "113 Robert Street"
 */
export function sanitizePropertyAddress(raw: string): string {
  let addr = raw.trim();

  const tailPatterns = [
    // "… and provided their contact details / and expressed urgency / and said …"
    /\s+and\s+(?:provided|gave|shared|mentioned|expressed|stated|said|noted|asked|requested)\b.*$/i,
    // "… providing her contact details …"
    /\s+providing\s+(?:her|his|their|the|contact|details|information)\b.*$/i,
    // "… expressing urgency …"
    /\s+expressing\s+.*$/i,
    // "… for next week / for a boundary survey / for this month"
    /\s+for\s+(?:next|this|the|a|as)\s+(?:week|month|survey|quote|boundary|alta|topographic|as[.\s_]?built|subdivision|construction|elevation|soon)\b.*$/i,
    // "… she also mentioned / he wants / they need …"
    /\s+(?:she|he|they)\s+(?:also|mentioned|provided|said|asked|expressed|wants?|needs?)\b.*$/i,
    // ", and the caller / , but they …"
    /[,\s]+\s*(?:and|but)\s+(?:she|he|they|the\s+(?:caller|user|customer|client))\b.*$/i,
  ];

  for (const pattern of tailPatterns) {
    addr = addr.replace(pattern, "");
  }

  // Clean trailing punctuation
  addr = addr.replace(/[.,;:]+$/, "").trim();

  return addr || raw.trim();
}

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
    urgency: "medium",
    email: null,
    phone: null,
    specialRequests: null,
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
        result.propertyAddress = sanitizePropertyAddress(addr);
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

  // Map timeline to urgency level
  result.urgency = deriveUrgency(result.timeline, fullText);

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

  // --- Extract phone number ---
  result.phone = extractPhone(fullText);

  // --- Extract special requests ---
  result.specialRequests = extractSpecialRequests(fullText);

  return result;
}

/**
 * Derive urgency level from timeline text and full conversation context.
 */
function deriveUrgency(
  timeline: string | null,
  fullText: string
): "low" | "medium" | "high" {
  const lower = (timeline || "").toLowerCase() + " " + fullText.toLowerCase();

  // High urgency indicators
  const highPatterns = [
    /\basap\b/,
    /\bright away\b/,
    /\bimmediately\b/,
    /\bthis week\b/,
    /\bnext (few )?days?\b/,
    /\brush\b/,
    /\burgent\b/,
    /\bexpedite\b/,
    /\btime[- ]?sensitive\b/,
    /\bclosing (soon|this|next)\b/,
    /\bdeadline\b/,
    /\bwithin\s+(?:a\s+)?(?:day|two|three|2|3)\s+days?\b/,
    /\bwithin\s+(?:a\s+)?week\b/,
  ];

  // Low urgency indicators
  const lowPatterns = [
    /\bno rush\b/,
    /\bno hurry\b/,
    /\bwhenever\b/,
    /\bno urgency\b/,
    /\bnot urgent\b/,
    /\btake (?:your|their) time\b/,
    /\bnext month\b/,
    /\bfew months\b/,
    /\bsometime\b/,
    /\beventually\b/,
    /\bflexible\b/,
    /\bno particular\b/,
  ];

  for (const pattern of highPatterns) {
    if (pattern.test(lower)) return "high";
  }

  for (const pattern of lowPatterns) {
    if (pattern.test(lower)) return "low";
  }

  // If we detected any timeline at all, lean toward medium-high
  if (timeline) return "medium";

  return "medium";
}

/**
 * Extract a phone number from text.
 * Looks for explicit "my number is..." or "reach me at..." patterns,
 * and also extracts standalone US phone number formats.
 */
function extractPhone(text: string): string | null {
  // Pattern 1: Explicit phone mention
  const explicitPatterns = [
    /(?:my (?:phone )?number is|reach me at|call me (?:at|back at)|phone(?:\s+number)?\s+is|contact.*?at)\s+([(\d][\d\s().-]{8,14}\d)/i,
    /(?:number|phone|cell|mobile)[\s:]+([(\d][\d\s().-]{8,14}\d)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    if (match) {
      const digits = match[1].replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 11) {
        return formatPhoneNumber(digits);
      }
    }
  }

  // Pattern 2: Spelled-out phone numbers in transcript
  // e.g., "five five five eight six seven five three zero nine"
  const digitWords: Record<string, string> = {
    zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  };
  const wordPattern = new RegExp(
    `(?:number is|reach me at|call me at)\\s+((?:${Object.keys(digitWords).join("|")})[\\s,]+(?:(?:${Object.keys(digitWords).join("|")})[\\s,]*){6,})`,
    "i"
  );
  const wordMatch = text.match(wordPattern);
  if (wordMatch) {
    const words = wordMatch[1].toLowerCase().split(/[\s,]+/);
    const digits = words.map((w) => digitWords[w]).filter(Boolean).join("");
    if (digits.length >= 10 && digits.length <= 11) {
      return formatPhoneNumber(digits);
    }
  }

  return null;
}

/**
 * Format a digit string as a US phone number.
 */
function formatPhoneNumber(digits: string): string {
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return digits;
}

/**
 * Extract special requests or additional notes from the conversation.
 */
function extractSpecialRequests(text: string): string | null {
  const patterns = [
    // Explicit mentions
    /(?:special request|additional(?:ly)?|also (?:need|want|require|asked|mention)|one more thing|keep in mind|please (?:note|also)|important(?:ly)?)[:\s]+(.+?)(?:\.\s+(?:The|They|He|She|I)|$)/i,
    // Retell summary patterns
    /(?:also (?:mentioned|requested|asked|noted|expressed))\s+(?:that\s+)?(.+?)(?:\.\s+(?:The|They|He|She)|$)/i,
    // "In addition" patterns
    /(?:in addition|furthermore|moreover)[,\s]+(.+?)(?:\.\s+(?:The|They|He|She)|$)/i,
    // Specific surveying-related requests
    /(?:need|want|require|asked for)\s+(?:the survey|a copy|copies|the plat|stakes?|markers?|flags?)(.+?)(?:\.\s|$)/i,
  ];

  const requests: string[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let req = (match[1] || match[0]).trim();
      req = req.replace(/\.$/, "").trim();
      if (req.length > 5 && req.length < 500) {
        requests.push(req);
      }
    }
  }

  return requests.length > 0 ? requests.join("; ") : null;
}
