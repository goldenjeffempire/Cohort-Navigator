/**
 * MLOps — Model Evaluation Harness
 *
 * A fixed suite of representative prompts (one per AI mode) run against the
 * currently active inference engine (self-hosted local model or the
 * built-in RAG fallback). Used as a lightweight continuous-evaluation gate:
 * run this after registering a new local model or prompt template change,
 * before promoting it to default, to catch latency regressions or empty /
 * degenerate responses.
 *
 * This intentionally does not depend on any external grading API — pass/fail
 * is judged by cheap, deterministic heuristics (non-empty, minimum length,
 * required-keyword coverage, latency budget). For deeper quality grading,
 * route a sample of ai_feedback ratings into this table instead of relying
 * solely on synthetic prompts (see docs/ai/mlops.md).
 */
import { renderPrompt } from "../prompts/index.js";
import type { InferenceEngine } from "../inference/index.js";

export interface EvalCase {
  name: string;
  mode: Parameters<typeof renderPrompt>[0];
  prompt: string;
  requiredKeywords?: string[];
  minLength?: number;
  maxLatencyMs?: number;
}

export const DEFAULT_EVAL_SUITE: EvalCase[] = [
  {
    name: "tutor-explain-concept",
    mode: "tutor",
    prompt: "Explain what a hash map is and why it's fast.",
    requiredKeywords: ["hash"],
    minLength: 40,
    maxLatencyMs: 15000,
  },
  {
    name: "code-debug-help",
    mode: "code",
    prompt: "My for loop never terminates, here is the code: for (let i = 0; i >= 0; i++) {}. What's wrong?",
    requiredKeywords: ["loop"],
    minLength: 30,
    maxLatencyMs: 15000,
  },
  {
    name: "assignment-feedback",
    mode: "assignment",
    prompt: "Give feedback on a student assignment that has no error handling and no comments.",
    minLength: 30,
    maxLatencyMs: 15000,
  },
  {
    name: "interview-question",
    mode: "interview",
    prompt: "Ask me one behavioral interview question.",
    minLength: 20,
    maxLatencyMs: 15000,
  },
  {
    name: "quiz-generation",
    mode: "quiz",
    prompt: "Give me one practice question about arrays.",
    requiredKeywords: ["array"],
    minLength: 20,
    maxLatencyMs: 15000,
  },
];

export interface EvalCaseResult {
  name: string;
  passed: boolean;
  latencyMs: number;
  outputTokens: number;
  note?: string;
}

export interface EvalSuiteResult {
  suiteName: string;
  casesRun: number;
  casesPassed: number;
  avgLatencyMs: number;
  avgOutputTokens: number;
  score: number; // 0-100
  details: EvalCaseResult[];
}

export async function runEvalSuite(
  engine: InferenceEngine,
  suite: EvalCase[] = DEFAULT_EVAL_SUITE,
  suiteName = "default",
): Promise<EvalSuiteResult> {
  const details: EvalCaseResult[] = [];

  for (const c of suite) {
    const system = renderPrompt(c.mode, {});
    const start = Date.now();
    try {
      const result = await engine.complete([
        { role: "system", content: system },
        { role: "user", content: c.prompt },
      ]);
      const latencyMs = Date.now() - start;
      const content = result.content.toLowerCase();

      let passed = true;
      let note: string | undefined;

      if (c.minLength && result.content.length < c.minLength) {
        passed = false;
        note = `Response too short (${result.content.length} < ${c.minLength} chars)`;
      }
      if (passed && c.requiredKeywords?.length) {
        const missing = c.requiredKeywords.filter((k) => !content.includes(k.toLowerCase()));
        if (missing.length > 0) {
          passed = false;
          note = `Missing expected keyword(s): ${missing.join(", ")}`;
        }
      }
      if (passed && c.maxLatencyMs && latencyMs > c.maxLatencyMs) {
        passed = false;
        note = `Latency ${latencyMs}ms exceeded budget ${c.maxLatencyMs}ms`;
      }

      details.push({ name: c.name, passed, latencyMs, outputTokens: result.outputTokens, note });
    } catch (err: any) {
      details.push({ name: c.name, passed: false, latencyMs: Date.now() - start, outputTokens: 0, note: `Error: ${err?.message ?? "unknown"}` });
    }
  }

  const casesRun = details.length;
  const casesPassed = details.filter((d) => d.passed).length;
  const avgLatencyMs = details.reduce((s, d) => s + d.latencyMs, 0) / Math.max(1, casesRun);
  const avgOutputTokens = details.reduce((s, d) => s + d.outputTokens, 0) / Math.max(1, casesRun);
  const score = Math.round((casesPassed / Math.max(1, casesRun)) * 100);

  return { suiteName, casesRun, casesPassed, avgLatencyMs, avgOutputTokens, score, details };
}
