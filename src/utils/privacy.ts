export interface PiiDetection {
  type: "Email" | "IBAN" | "Phone" | "Account / Card" | "Personal Name Prefix";
  match: string;
  replacement: string;
}

export interface PrivacyScanResult {
  hasPii: boolean;
  detections: PiiDetection[];
  sanitizedText: string;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9\s]{10,30}\b/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g;
const ACCOUNT_REGEX = /\b(?:\d[ -]*?){10,19}\b/g;
const NAME_PREFIX_REGEX = /\b(?:From|Sender|Student|Patient|Client|Tenant|Attn):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g;

export function scanAndSanitizePii(input: string): PrivacyScanResult {
  const detections: PiiDetection[] = [];
  let sanitized = input;

  sanitized = sanitized.replace(EMAIL_REGEX, (match) => {
    detections.push({ type: "Email", match, replacement: "[REDACTED_EMAIL]" });
    return "[REDACTED_EMAIL]";
  });

  sanitized = sanitized.replace(IBAN_REGEX, (match) => {
    detections.push({ type: "IBAN", match, replacement: "[REDACTED_IBAN]" });
    return "[REDACTED_IBAN]";
  });

  sanitized = sanitized.replace(PHONE_REGEX, (match) => {
    detections.push({ type: "Phone", match, replacement: "[REDACTED_PHONE]" });
    return "[REDACTED_PHONE]";
  });

  sanitized = sanitized.replace(ACCOUNT_REGEX, (match) => {
    // Avoid scrubbing clean dates like 2026-11-19 or short currency amounts
    const digitsOnly = match.replace(/\D/g, "");
    if (digitsOnly.length < 10) return match;
    detections.push({
      type: "Account / Card",
      match,
      replacement: "[REDACTED_ACCOUNT]",
    });
    return "[REDACTED_ACCOUNT]";
  });

  sanitized = sanitized.replace(NAME_PREFIX_REGEX, (full, namePart: string) => {
    detections.push({
      type: "Personal Name Prefix",
      match: namePart,
      replacement: "[REDACTED_NAME]",
    });
    return full.replace(namePart, "[REDACTED_NAME]");
  });

  return {
    hasPii: detections.length > 0,
    detections,
    sanitizedText: sanitized,
  };
}

export interface ProhibitedDomainCheck {
  flagged: boolean;
  reasons: string[];
}

const PROHIBITED_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /\b(diagnos|medication|leaflet|symptom|dosage|prescription|medical advice|therapy|clinic)\b/i,
    reason:
      "Mentions health/medical interpretation. The brief prohibits health-advice tasks because errors cause harm and cannot be reliably verified.",
  },
  {
    regex: /\b(rental contract|legal advice|lawsuit|liability|statute|attorney|contract review|compliance advice)\b/i,
    reason:
      "Mentions legal or contract advice. The brief prohibits legal-advice tasks.",
  },
  {
    regex: /\b(invest|portfolio advice|stock pick|tax advice|financial advice|should i buy|loan advice)\b/i,
    reason:
      "Mentions financial advice. Categorizing your own spending is permitted, but advising on what to do with money is prohibited.",
  },
  {
    regex: /\b(persuasive|is this good|rate quality|subjective opinion|creative writing)\b/i,
    reason:
      "Appears subjective with no checkable ground truth (e.g., 'is this argument persuasive?'). Tasks must be independently verifiable.",
  },
];

export function checkProhibitedTask(text: string): ProhibitedDomainCheck {
  const reasons: string[] = [];
  for (const rule of PROHIBITED_PATTERNS) {
    if (rule.regex.test(text)) {
      reasons.push(rule.reason);
    }
  }
  return {
    flagged: reasons.length > 0,
    reasons,
  };
}
