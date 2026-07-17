/**
 * AI Security Module
 *
 * Layered defences beyond the basic prompt-injection guard in prompts/index.ts:
 *
 *  1. Abuse detection  — burst/rate-pattern analysis per user
 *  2. Content scoring  — expanded toxicity and harmful-content detection
 *  3. PII scrubbing    — strip common PII patterns before logging
 *  4. Anomaly flags    — unusual usage patterns that warrant review
 *
 * All logic is rule-based and deterministic — no external APIs or ML models.
 */

// ─── Rate / abuse tracking ────────────────────────────────────────────────────

export interface RequestRecord {
  userId: number;
  timestamp: number;  // Unix ms
  mode: string;
  contentLength: number;
}

// In-process sliding-window request store (per user)
// Flushed when the process restarts — backed by DB audit logs for persistence.
const userWindows = new Map<number, RequestRecord[]>();
const WINDOW_MS = 60 * 1000;    // 1-minute sliding window

export function recordRequest(record: RequestRecord): void {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  let records = userWindows.get(record.userId) ?? [];
  records = records.filter((r) => r.timestamp > windowStart);
  records.push(record);
  userWindows.set(record.userId, records);
}

export interface AbuseAssessment {
  isAbusive: boolean;
  reasons: string[];
  severity: "low" | "medium" | "high";
  suggestedAction: "allow" | "warn" | "throttle" | "block";
}

/**
 * Detect burst and pattern-based abuse for a user over the last minute.
 */
export function assessAbuse(userId: number): AbuseAssessment {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const records = (userWindows.get(userId) ?? []).filter((r) => r.timestamp > windowStart);

  const reasons: string[] = [];
  let severity: AbuseAssessment["severity"] = "low";

  // Burst: too many requests in the window
  if (records.length > 30) {
    reasons.push(`Burst: ${records.length} requests in 60s (limit: 30)`);
    severity = "high";
  } else if (records.length > 20) {
    reasons.push(`High frequency: ${records.length} requests in 60s`);
    severity = "medium";
  }

  // Repeated identical content (copy-paste spam)
  const contentLengths = records.map((r) => r.contentLength);
  const commonLength = contentLengths.filter((l) => l === contentLengths[0]).length;
  if (records.length > 5 && commonLength / records.length > 0.8) {
    reasons.push("Repeated identical requests (possible spam)");
    severity = severity === "high" ? "high" : "medium";
  }

  // Extremely large payloads (possible prompt stuffing)
  const largeMsgs = records.filter((r) => r.contentLength > 8000).length;
  if (largeMsgs > 2) {
    reasons.push(`${largeMsgs} very large payloads (possible prompt stuffing)`);
    severity = "medium";
  }

  const isAbusive = reasons.length > 0;
  let suggestedAction: AbuseAssessment["suggestedAction"] = "allow";
  if (severity === "high")        suggestedAction = "block";
  else if (severity === "medium") suggestedAction = "throttle";
  else if (isAbusive)             suggestedAction = "warn";

  return { isAbusive, reasons, severity, suggestedAction };
}

// ─── Enhanced content safety scoring ─────────────────────────────────────────

export interface ContentSafetyResult {
  safe: boolean;
  score: number;        // 0 (safe) to 100 (dangerous)
  categories: string[]; // triggered categories
  reason?: string;
}

const SAFETY_RULES: Array<{
  pattern: RegExp;
  category: string;
  score: number;
}> = [
  // Prompt injection / jailbreaking
  { pattern: /ignore (all |previous |above |prior )?instructions/i,         category: "prompt_injection",  score: 80 },
  { pattern: /you are now|act as (a |an |if )?/i,                           category: "prompt_injection",  score: 70 },
  { pattern: /forget (everything|your instructions|your training)/i,        category: "prompt_injection",  score: 80 },
  { pattern: /override (your |all )?instructions/i,                         category: "prompt_injection",  score: 80 },
  { pattern: /\bdan\b.*mode|\bjailbreak\b/i,                                category: "jailbreak",         score: 90 },
  { pattern: /do anything now|enable dev mode/i,                            category: "jailbreak",         score: 85 },
  // Harmful technical content
  { pattern: /how to (hack|attack|exploit|ddos|bruteforce)/i,               category: "harmful_technical", score: 90 },
  { pattern: /(write|create|generate) (malware|virus|ransomware|keylogger)/i, category: "malware",         score: 95 },
  { pattern: /steal (credentials|passwords|data|tokens)/i,                  category: "data_theft",        score: 90 },
  { pattern: /sql injection.*(payload|attack|bypass)/i,                     category: "sql_injection",     score: 75 },
  { pattern: /cross.site scripting|xss (attack|payload)/i,                  category: "xss",               score: 70 },
  // PII extraction attempts
  { pattern: /tell me (all |every)?(user|student).*(email|password|data)/i, category: "pii_extraction",    score: 70 },
  { pattern: /dump (the |all )?(database|users|table)/i,                    category: "data_exfiltration", score: 75 },
  // Academic dishonesty (in graded contexts)
  { pattern: /solve (the |this )?(entire |whole )?assignment for me/i,      category: "academic_dishonesty", score: 40 },
  { pattern: /complete (the |this )?(entire |whole )?assignment/i,          category: "academic_dishonesty", score: 35 },
];

export function scoreContentSafety(content: string): ContentSafetyResult {
  const categories: string[] = [];
  let totalScore = 0;

  for (const rule of SAFETY_RULES) {
    if (rule.pattern.test(content)) {
      if (!categories.includes(rule.category)) {
        categories.push(rule.category);
        totalScore = Math.max(totalScore, rule.score);
      }
    }
  }

  const BLOCK_THRESHOLD = 60;
  return {
    safe: totalScore < BLOCK_THRESHOLD,
    score: totalScore,
    categories,
    reason: categories.length > 0 ? categories[0] : undefined,
  };
}

// ─── PII scrubbing for audit logs ─────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,   replacement: "[EMAIL]"  },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,                       replacement: "[PHONE]"  },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,             replacement: "[CARD]"   },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g,                                    replacement: "[SSN]"    },
  { pattern: /password[:\s]+\S+/gi,                                        replacement: "password:[REDACTED]" },
  { pattern: /token[:\s]+[A-Za-z0-9._-]{20,}/gi,                          replacement: "token:[REDACTED]"    },
  { pattern: /bearer\s+[A-Za-z0-9._-]{20,}/gi,                            replacement: "bearer [REDACTED]"   },
  { pattern: /api[_-]?key[:\s]+[A-Za-z0-9_-]{16,}/gi,                    replacement: "api_key:[REDACTED]"  },
];

export function scrubPII(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ─── Anomaly detection ────────────────────────────────────────────────────────

export interface UsageAnomaly {
  type: "off_hours_burst" | "mode_switching" | "unusually_long_content" | "repeated_failures";
  detail: string;
  userId: number;
  severity: "low" | "medium";
}

export function detectUsageAnomalies(
  userId: number,
  records: RequestRecord[],
): UsageAnomaly[] {
  const anomalies: UsageAnomaly[] = [];

  // Off-hours burst (between midnight and 5am local-ish — based on UTC timestamp)
  const offHoursRecords = records.filter((r) => {
    const hour = new Date(r.timestamp).getUTCHours();
    return hour >= 0 && hour < 5;
  });
  if (offHoursRecords.length > 15) {
    anomalies.push({
      type: "off_hours_burst",
      detail: `${offHoursRecords.length} requests between midnight-5am UTC`,
      userId,
      severity: "low",
    });
  }

  // Rapid mode switching (possible systematic probing)
  const modes = records.slice(-10).map((r) => r.mode);
  const uniqueModes = new Set(modes).size;
  if (records.length >= 10 && uniqueModes >= 5) {
    anomalies.push({
      type: "mode_switching",
      detail: `Switched between ${uniqueModes} AI modes in last 10 requests`,
      userId,
      severity: "low",
    });
  }

  // Unusually long content repeatedly
  const longMsgs = records.filter((r) => r.contentLength > 5000);
  if (longMsgs.length > 3) {
    anomalies.push({
      type: "unusually_long_content",
      detail: `${longMsgs.length} messages over 5000 characters`,
      userId,
      severity: "medium",
    });
  }

  return anomalies;
}
