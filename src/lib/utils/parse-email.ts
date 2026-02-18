/**
 * Parses an inbound email for survey-related lead information.
 *
 * Common email patterns from potential clients:
 *   "Hi, I need a boundary survey for my property at 123 Main St.
 *    We're closing next Friday so it's urgent."
 *
 *   "Can you give me a quote for an ALTA survey at
 *    456 Oak Ave, Austin TX 78701? My name is John Smith."
 *
 *   "We need a topo survey done for a new construction project
 *    at 789 Pine Road. Please call me at 555-867-5309."
 */

export interface ParsedEmail {
  isLeadRequest: boolean; // does this look like a survey request?
  propertyAddress: string | null;
  surveyType: string | null;
  callerName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  timeline: string | null;
  urgency: "low" | "medium" | "high";
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

// Keywords that indicate this email is a survey inquiry
const SURVEY_KEYWORDS = [
  "survey", "surveyor", "surveying",
  "boundary", "alta", "topographic", "topo", "as-built", "as built",
  "plat", "subdivision",
  "quote", "estimate", "bid", "proposal",
  "property line", "lot line", "easement",
  "closing", "title company", "lender requirement",
  "construction staking", "elevation certificate",
];

// Keywords that indicate this is NOT a lead (auto-replies, newsletters, etc.)
const SPAM_INDICATORS = [
  "unsubscribe", "opt out", "do not reply", "noreply",
  "auto-reply", "out of office", "automatic reply",
  "newsletter", "marketing", "promotion",
];

export function parseEmail(
  subject: string,
  body: string,
  fromEmail: string
): ParsedEmail {
  const result: ParsedEmail = {
    isLeadRequest: false,
    propertyAddress: null,
    surveyType: null,
    callerName: null,
    firstName: null,
    lastName: null,
    phone: null,
    email: fromEmail,
    timeline: null,
    urgency: "medium",
  };

  const fullText = `${subject} ${body}`.toLowerCase();

  // Check for spam/auto-reply indicators
  if (SPAM_INDICATORS.some((s) => fullText.includes(s))) {
    return result;
  }

  // Check if this looks like a survey request
  const matchCount = SURVEY_KEYWORDS.filter((kw) =>
    fullText.includes(kw)
  ).length;
  result.isLeadRequest = matchCount >= 1;

  if (!result.isLeadRequest) return result;

  const originalText = `${subject} ${body}`;

  // --- Extract survey type ---
  const surveyTypeMatch = originalText.match(
    /(?:a|an|the)\s+(boundary|alta(?:\/nsps)?|topographic|topo|as[- ]built|subdivision|construction|elevation\s+cert(?:ificate)?|route)\s+survey/i
  );
  if (surveyTypeMatch) {
    const raw = surveyTypeMatch[1].toLowerCase();
    result.surveyType = SURVEY_TYPE_MAP[raw] || "boundary";
  }

  // Also check subject line alone
  if (!result.surveyType) {
    for (const [keyword, type] of Object.entries(SURVEY_TYPE_MAP)) {
      if (subject.toLowerCase().includes(keyword)) {
        result.surveyType = type;
        break;
      }
    }
  }

  // --- Extract property address ---
  const addressPatterns = [
    // "at 123 Main Street" / "at 123 Main St, City, ST 12345"
    /(?:at|for|on|address[: ]+)\s*(\d+\s+[A-Za-z0-9\s,.]+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)[A-Za-z0-9\s,.]*?)(?:\.|,?\s*(?:We|I|My|Please|The|It|This|Can)|$)/im,
    // "property at 123 Main St"
    /(?:property|lot|land|home|house|parcel)\s+(?:at|on|is)\s+(\d+\s+[A-Za-z0-9\s,.']+?)(?:\.|,?\s*(?:We|I|My|Please|The)|$)/im,
    // Standalone address line: "123 Main Street, Austin, TX 78701"
    /^(\d+\s+[A-Z][A-Za-z]+(?:\s+[A-Za-z]+)*(?:\s+(?:St|Ave|Rd|Dr|Blvd|Ln|Ct|Way|Pl|Cir)\.?)?(?:,\s*[A-Za-z\s]+)?(?:,\s*[A-Z]{2}\s*\d{5})?)\s*$/m,
  ];

  for (const pattern of addressPatterns) {
    const match = originalText.match(pattern);
    if (match) {
      let addr = match[1].trim();
      addr = addr.replace(/[.,]+$/, "").trim();
      if (addr.length > 5 && /\d/.test(addr)) {
        result.propertyAddress = addr;
        break;
      }
    }
  }

  // --- Extract caller name ---
  // From signature-style patterns
  const namePatterns = [
    /(?:^|\n)(?:Thanks|Thank you|Best|Regards|Sincerely|Cheers),?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s*$/m,
    /(?:My name is|I'm|This is|I am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/,
    /^(?:Hi|Hello|Hey|Dear)[,.]?\s*(?:this is|my name is|I'm)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/m,
  ];

  for (const pattern of namePatterns) {
    const match = originalText.match(pattern);
    if (match) {
      result.callerName = match[1].trim();
      const parts = result.callerName.split(/\s+/);
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(" ") || null;
      break;
    }
  }

  // --- Extract phone ---
  const phoneMatch = originalText.match(
    /(?:call|phone|cell|mobile|reach me|contact)[:\s]*(?:at\s+)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i
  );
  if (phoneMatch) {
    result.phone = phoneMatch[1];
  }
  // Also try standalone phone pattern
  if (!result.phone) {
    const standalonePhone = originalText.match(
      /(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/
    );
    if (standalonePhone) {
      result.phone = standalonePhone[1];
    }
  }

  // --- Detect urgency ---
  const urgentPatterns = [
    /as soon as possible|asap|urgent|rush|emergency|immediately/i,
    /closing\s+(?:next|this)\s+\w+/i,
    /need(?:ed)?\s+(?:by|before)\s+(?:next|this)\s+\w+/i,
    /time[- ]?sensitive/i,
    /deadline/i,
  ];

  const timelinePatterns = [
    /(?:closing|needed|due|deadline|wanted|done|completed|finished|scheduled)\s+(?:is\s+)?(?:on\s+|by\s+|for\s+|within\s+|next\s+|this\s+)([^.!?\n]+)/i,
    /((?:next|this)\s+(?:week|month|friday|monday|tuesday|wednesday|thursday))/i,
    /(within\s+\d+\s+(?:days?|weeks?|months?))/i,
    /((?:by|before)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+)/i,
  ];

  if (urgentPatterns.some((p) => p.test(originalText))) {
    result.urgency = "high";
  }

  for (const pattern of timelinePatterns) {
    const match = originalText.match(pattern);
    if (match) {
      result.timeline = match[1]?.trim() || match[0]?.trim();
      break;
    }
  }

  return result;
}
