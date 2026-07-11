/**
 * AI Code & Assignment Analysis
 *
 * Rule-based analysis for code quality, complexity, and assignment scoring.
 * Works without an LLM — provides real, actionable metrics.
 */

// ─── Code quality analysis ────────────────────────────────────────────────────

export interface CodeQualityReport {
  score: number;          // 0-100
  grade: string;          // A-F
  metrics: CodeMetrics;
  issues: CodeIssue[];
  suggestions: string[];
  summary: string;
}

export interface CodeMetrics {
  linesOfCode: number;
  logicalLines: number;
  commentLines: number;
  commentRatio: number;
  maxNesting: number;
  functionCount: number;
  avgFunctionLength: number;
  duplicateLineRatio: number;
  magicNumbers: number;
}

export interface CodeIssue {
  type: "error" | "warning" | "info";
  category: "readability" | "complexity" | "performance" | "style" | "security";
  message: string;
  line?: number;
  suggestion?: string;
}

export function analyzeCode(code: string, language = "javascript"): CodeQualityReport {
  const lines = code.split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith("//") || t.startsWith("#") || t.startsWith("*") || t.startsWith("/*");
  });
  const logicalLines = nonEmpty.filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("#") && !t.startsWith("*") && t !== "{" && t !== "}";
  });

  // Nesting depth
  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of lines) {
    currentNesting += (line.match(/\{/g) ?? []).length;
    currentNesting -= (line.match(/\}/g) ?? []).length;
    if (currentNesting > maxNesting) maxNesting = currentNesting;
  }

  // Function count
  const funcMatches = code.match(/\bfunction\b|\b=>\s*\{|def\s+\w+\s*\(|fn\s+\w+/g) ?? [];
  const functionCount = funcMatches.length;

  // Magic numbers
  const magicNumbers = (code.match(/(?<![a-zA-Z_])(?<!\.)\b\d{2,}\b(?!\s*[;,)])/g) ?? []).length;

  // Duplicates (simple: count duplicate lines)
  const lineSet = new Set<string>();
  let dupCount = 0;
  for (const l of nonEmpty) {
    const t = l.trim();
    if (t.length > 10) {
      if (lineSet.has(t)) dupCount++;
      else lineSet.add(t);
    }
  }
  const duplicateLineRatio = nonEmpty.length > 0 ? dupCount / nonEmpty.length : 0;

  const metrics: CodeMetrics = {
    linesOfCode: lines.length,
    logicalLines: logicalLines.length,
    commentLines: commentLines.length,
    commentRatio: nonEmpty.length > 0 ? commentLines.length / nonEmpty.length : 0,
    maxNesting,
    functionCount,
    avgFunctionLength: functionCount > 0 ? logicalLines.length / functionCount : logicalLines.length,
    duplicateLineRatio,
    magicNumbers,
  };

  const issues: CodeIssue[] = [];
  let score = 100;

  // Nesting depth
  if (maxNesting > 5) {
    issues.push({ type: "warning", category: "complexity", message: `High nesting depth (${maxNesting} levels) — consider extracting functions`, suggestion: "Extract nested logic into separate functions" });
    score -= 10;
  }

  // Comment ratio
  if (metrics.commentRatio < 0.05 && logicalLines.length > 20) {
    issues.push({ type: "info", category: "readability", message: "Low comment density — consider adding documentation", suggestion: "Add comments for complex logic and function purposes" });
    score -= 5;
  }

  // Long functions
  if (metrics.avgFunctionLength > 50) {
    issues.push({ type: "warning", category: "complexity", message: "Functions are quite long on average", suggestion: "Break large functions into smaller, single-purpose functions" });
    score -= 10;
  }

  // Magic numbers
  if (magicNumbers > 3) {
    issues.push({ type: "info", category: "readability", message: `${magicNumbers} magic numbers found — use named constants`, suggestion: "Replace magic numbers with descriptive constant names" });
    score -= 5;
  }

  // Duplicates
  if (duplicateLineRatio > 0.15) {
    issues.push({ type: "warning", category: "style", message: "Code duplication detected — consider DRY refactoring", suggestion: "Extract repeated logic into reusable functions" });
    score -= 10;
  }

  // Security: eval
  if (/\beval\s*\(/.test(code) && (language === "javascript" || language === "typescript")) {
    issues.push({ type: "error", category: "security", message: "Use of eval() is a security risk", suggestion: "Avoid eval(); use JSON.parse() or structured alternatives" });
    score -= 20;
  }

  // Long lines
  const longLines = lines.filter((l) => l.length > 120).length;
  if (longLines > 2) {
    issues.push({ type: "info", category: "style", message: `${longLines} lines exceed 120 characters`, suggestion: "Break long lines for readability" });
    score -= 3;
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const suggestions: string[] = [];
  if (metrics.commentRatio < 0.1) suggestions.push("Add meaningful comments to complex sections");
  if (maxNesting > 3) suggestions.push("Reduce nesting by using early returns and guard clauses");
  if (metrics.functionCount === 0 && logicalLines.length > 30) suggestions.push("Organise code into functions for better structure");
  if (duplicateLineRatio > 0.1) suggestions.push("Extract repeated patterns into helper functions");

  const summary = `Code quality score: ${score}/100 (${grade}). ${issues.length} issue(s) found. ${suggestions.length > 0 ? "Key improvement: " + suggestions[0] : "Good code structure!"}`;

  return { score, grade, metrics, issues, suggestions, summary };
}

// ─── Assignment scoring ───────────────────────────────────────────────────────

export interface AssignmentScore {
  total: number;       // 0-100
  breakdown: Record<string, number>;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export function scoreAssignmentCode(
  code: string,
  language: string,
  rubric?: Record<string, number>,
): AssignmentScore {
  const quality = analyzeCode(code, language);
  const defaultRubric = { correctness: 40, code_quality: 25, readability: 20, documentation: 15 };
  const r = rubric ?? defaultRubric;

  const breakdown: Record<string, number> = {};
  breakdown.code_quality = Math.round((quality.score / 100) * (r.code_quality ?? 25));
  breakdown.readability = Math.round((quality.metrics.commentRatio > 0.05 ? 0.8 : 0.5) * (r.readability ?? 20));
  breakdown.documentation = Math.round((quality.metrics.commentRatio > 0.1 ? 1.0 : quality.metrics.commentRatio > 0.05 ? 0.7 : 0.4) * (r.documentation ?? 15));
  breakdown.correctness = r.correctness ?? 40; // Requires test execution for full score

  const total = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (quality.score >= 80) strengths.push("High overall code quality");
  if (quality.metrics.commentRatio > 0.1) strengths.push("Well-documented code");
  if (quality.metrics.maxNesting <= 3) strengths.push("Clean, low-complexity structure");
  if (quality.metrics.magicNumbers === 0) strengths.push("No magic numbers — good use of constants");

  for (const issue of quality.issues) {
    improvements.push(issue.suggestion ?? issue.message);
  }
  if (quality.metrics.functionCount === 0 && code.split("\n").length > 20) {
    improvements.push("Organise code into named functions");
  }

  const feedback = `Assignment analysis complete. Code quality: ${quality.grade} (${quality.score}/100). ${quality.issues.length} issue(s) identified. ${strengths.length > 0 ? "Strong points: " + strengths[0] + "." : ""} ${improvements.length > 0 ? "Main improvement area: " + improvements[0] + "." : ""}`;

  return { total, breakdown, feedback, strengths, improvements };
}

// ─── Learning analytics ────────────────────────────────────────────────────────

export interface LearningInsight {
  type: "strength" | "weakness" | "recommendation" | "risk";
  topic: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export function generateLearningInsights(
  submissionHistory: Array<{ challengeId: number; status: string; score: number; language: string }>,
  progressPercent: number,
): LearningInsight[] {
  const insights: LearningInsight[] = [];
  const total = submissionHistory.length;
  if (total === 0) {
    insights.push({ type: "recommendation", topic: "Getting Started", detail: "Start with the practice challenges to build your coding skills.", priority: "high" });
    return insights;
  }

  const passed = submissionHistory.filter((s) => s.status === "passed").length;
  const passRate = passed / total;

  // Overall performance
  if (passRate < 0.4) {
    insights.push({ type: "risk", topic: "Challenge Completion", detail: `Pass rate of ${Math.round(passRate * 100)}% — consider reviewing foundational concepts.`, priority: "high" });
  } else if (passRate > 0.8) {
    insights.push({ type: "strength", topic: "Challenge Completion", detail: `Excellent ${Math.round(passRate * 100)}% pass rate — strong problem-solving ability.`, priority: "low" });
  }

  // Language breakdown
  const langCounts: Record<string, { total: number; passed: number }> = {};
  for (const s of submissionHistory) {
    if (!langCounts[s.language]) langCounts[s.language] = { total: 0, passed: 0 };
    langCounts[s.language].total++;
    if (s.status === "passed") langCounts[s.language].passed++;
  }
  for (const [lang, counts] of Object.entries(langCounts)) {
    const lr = counts.passed / counts.total;
    if (lr < 0.5) {
      insights.push({ type: "weakness", topic: `${lang} proficiency`, detail: `Only ${Math.round(lr * 100)}% pass rate in ${lang} — more practice needed.`, priority: "medium" });
    }
  }

  // Progress
  if (progressPercent < 30) {
    insights.push({ type: "recommendation", topic: "Course Progress", detail: "You're in the early stages — try to complete at least 2-3 lessons per week.", priority: "medium" });
  }

  return insights;
}
