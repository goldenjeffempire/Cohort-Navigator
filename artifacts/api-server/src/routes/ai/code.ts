/**
 * AI Code Assistant routes
 *
 * POST /ai/code/analyze  — code quality analysis (rule-based, instant)
 * POST /ai/code/explain  — explain code (streaming)
 * POST /ai/code/hint     — challenge hint (streaming, no answer reveal)
 * POST /ai/code/review   — full code review (streaming)
 */
import { Router } from "express";
import { db, aiAuditLogsTable } from "@workspace/db";
import { inferenceEngine } from "@workspace/ai-engine/inference";
import { renderPrompt, sanitizeInput } from "@workspace/ai-engine/prompts";
import { analyzeCode } from "@workspace/ai-engine/analysis";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

// ─── Code quality analysis (instant, rule-based) ─────────────────────────────

router.post("/ai/code/analyze", requireAuth, async (req, res): Promise<void> => {
  const { code, language = "javascript" } = req.body;
  if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

  const report = analyzeCode(code, language);
  res.json(report);
});

// ─── Helper: stream an AI response ───────────────────────────────────────────

async function streamAIResponse(
  res: any,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    for await (const chunk of inferenceEngine.stream(messages)) {
      if (!chunk.done) {
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "AI error", done: true })}\n\n`);
  }
  res.end();
}

// ─── Code explanation ─────────────────────────────────────────────────────────

router.post("/ai/code/explain", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { code, language = "javascript", question } = req.body;
  if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

  const safetyCheck = sanitizeInput(question ?? "");
  if (!safetyCheck.safe) { res.status(400).json({ error: "Request blocked" }); return; }

  const system = renderPrompt("code", {
    userName: req.user!.name,
    challengeLanguage: language,
  });

  const userMsg = question
    ? `Please explain this ${language} code and answer: "${question}"\n\n\`\`\`${language}\n${code}\n\`\`\``
    : `Please explain what this ${language} code does, step by step:\n\n\`\`\`${language}\n${code}\n\`\`\``;

  await db.insert(aiAuditLogsTable).values({
    userId,
    event: "inference_request",
    requestSummary: `code/explain: ${language} (${code.length} chars)`,
    responseStatus: "ok",
  });

  await streamAIResponse(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Hint generation (no answer reveal) ──────────────────────────────────────

router.post("/ai/code/hint", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { code, language = "javascript", challengeTitle, problemDescription } = req.body;

  const system = renderPrompt("code", {
    userName: req.user!.name,
    challengeLanguage: language,
    challengeTitle: challengeTitle ?? "this challenge",
  });

  const hintInstructions = `IMPORTANT: You are providing a HINT only. Do NOT write the complete solution or reveal the answer directly. Instead:
1. Point to the conceptual gap or missing piece
2. Ask a guiding question to steer thinking
3. Suggest a relevant technique or data structure to consider
4. Give a tiny illustrative example of a similar (but different) concept if helpful

Challenge: ${challengeTitle ?? "coding challenge"}
Problem: ${problemDescription ?? "(not provided)"}

Student's current code:
\`\`\`${language}
${code ?? "(no code yet)"}
\`\`\`

Give ONE targeted hint. Keep it under 100 words.`;

  await db.insert(aiAuditLogsTable).values({
    userId, event: "inference_request",
    requestSummary: `code/hint: ${challengeTitle}`,
    responseStatus: "ok",
  });

  await streamAIResponse(res, [
    { role: "system", content: system },
    { role: "user", content: hintInstructions },
  ]);
});

// ─── Full code review ─────────────────────────────────────────────────────────

router.post("/ai/code/review", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { code, language = "javascript", context } = req.body;
  if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

  // Run rule-based analysis first (fast)
  const analysis = analyzeCode(code, language);

  const system = renderPrompt("review", { userName: req.user!.name });
  const userMsg = `Review this ${language} code. Pre-analysis: Score ${analysis.score}/100, ${analysis.issues.length} issues found.

Context: ${context ?? "general review"}

\`\`\`${language}
${code}
\`\`\`

Provide a structured review covering: correctness, quality, readability, best practices, and security (if applicable). Be specific with line references where possible.`;

  await db.insert(aiAuditLogsTable).values({
    userId, event: "inference_request",
    requestSummary: `code/review: ${language} score=${analysis.score}`,
    responseStatus: "ok",
  });

  await streamAIResponse(res, [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ]);
});

export default router;
