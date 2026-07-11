/**
 * POST /api/execute — run code in a sandboxed process and return the output.
 * Logs every execution for audit and analytics.
 */
import { Router, type IRouter } from "express";
import { db, codeExecutionLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { executeCode, type SupportedLanguage } from "../lib/executor";

const router: IRouter = Router();

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "javascript", "typescript", "python", "bash", "html", "css", "sql",
];

// Simple in-memory rate limiter: max 20 executions per minute per user
const rateLimitMap = new Map<number, { count: number; resetAt: number }>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

router.post("/execute", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Max 20 executions per minute." });
    return;
  }

  const { code, language, stdin, challengeId } = req.body as {
    code?: string;
    language?: string;
    stdin?: string;
    challengeId?: number;
  };

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }
  if (!language || !SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
    res.status(400).json({
      error: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
    });
    return;
  }

  const result = await executeCode({
    code,
    language: language as SupportedLanguage,
    stdin: typeof stdin === "string" ? stdin : "",
    timeoutMs: 10_000,
  });

  // Log asynchronously — don't let logging failure block response
  db.insert(codeExecutionLogsTable).values({
    userId,
    challengeId: typeof challengeId === "number" ? challengeId : null,
    code,
    language: language as SupportedLanguage,
    stdin: stdin ?? null,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    executionTimeMs: result.executionTimeMs,
  }).catch(() => {});

  res.json(result);
});

export default router;
