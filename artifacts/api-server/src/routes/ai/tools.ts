/**
 * AI Specialised Tools routes
 *
 * POST /ai/assignment/feedback  — assignment review + feedback (streaming)
 * POST /ai/interview/question   — generate interview question (streaming)
 * POST /ai/interview/evaluate   — evaluate candidate answer (streaming)
 * POST /ai/career/analyze       — career profile analysis (streaming)
 * POST /ai/quiz/generate        — generate practice quiz (streaming)
 * POST /ai/content/generate     — generate learning content (streaming)
 * POST /ai/learning/path        — personalised learning path
 * POST /ai/learning/insights    — skill gap + learning insights
 */
import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  aiAuditLogsTable,
  challengeSubmissionsTable,
  usersTable,
} from "@workspace/db";
import { inferenceEngine } from "@workspace/ai-engine/inference";
import { renderPrompt, sanitizeInput } from "@workspace/ai-engine/prompts";
import { scoreAssignmentCode, generateLearningInsights } from "@workspace/ai-engine/analysis";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

const router = Router();

async function stream(res: any, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  try {
    for await (const chunk of inferenceEngine.stream(messages)) {
      if (!chunk.done) res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      else res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "AI error", done: true })}\n\n`);
  }
  res.end();
}

// ─── Assignment feedback ──────────────────────────────────────────────────────

router.post("/ai/assignment/feedback", requireAuth, async (req, res): Promise<void> => {
  const { submissionText, assignmentTitle, rubric, language } = req.body;
  if (!submissionText) { res.status(400).json({ error: "submissionText required" }); return; }

  const scoreReport = language ? scoreAssignmentCode(submissionText, language, rubric) : null;
  const system = renderPrompt("assignment", { userName: req.user!.name, assignmentTitle });
  const userMsg = `Review this assignment submission for "${assignmentTitle ?? "the assignment"}":

${scoreReport ? `Pre-analysis: Score ${scoreReport.total}/100. Strengths: ${scoreReport.strengths.join(", ") || "none noted"}. Improvements: ${scoreReport.improvements.slice(0, 2).join(", ")}.` : ""}

Submission:
---
${submissionText.slice(0, 3000)}
---

Provide: (1) What's done well, (2) What needs improvement, (3) Specific actionable suggestions, (4) A score estimate out of 100.`;

  await db.insert(aiAuditLogsTable).values({ userId: req.user!.id, event: "inference_request", requestSummary: `assignment/feedback: ${assignmentTitle}`, responseStatus: "ok" });
  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Interview question generator ─────────────────────────────────────────────

router.post("/ai/interview/question", requireAuth, async (req, res): Promise<void> => {
  const { topic = "general", difficulty = "medium", type = "technical", previousQuestions = [] } = req.body;

  const system = renderPrompt("interview", { userName: req.user!.name });
  const prevList = previousQuestions.length > 0 ? `\nAvoid repeating these topics: ${previousQuestions.join(", ")}` : "";
  const userMsg = `Generate ONE ${difficulty} ${type} interview question about: ${topic}.${prevList}

Format:
**Question:** [the question]
**What to look for:** [key points in a strong answer]
**Follow-up:** [one follow-up question]`;

  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Interview answer evaluation ──────────────────────────────────────────────

router.post("/ai/interview/evaluate", requireAuth, async (req, res): Promise<void> => {
  const { question, answer, expectedKeyPoints = [] } = req.body;
  if (!question || !answer) { res.status(400).json({ error: "question and answer required" }); return; }

  const system = renderPrompt("interview", { userName: req.user!.name });
  const userMsg = `Evaluate this interview answer:

**Question:** ${question}
**Candidate's Answer:** ${answer}
${expectedKeyPoints.length > 0 ? `**Expected Key Points:** ${expectedKeyPoints.join(", ")}` : ""}

Provide structured feedback:
1. **Score:** X/10
2. **Strengths:** (2-3 specific things done well)
3. **Gaps:** (what was missing or incorrect)
4. **How to improve:** (specific advice)
5. **Model answer summary:** (what an excellent answer would include)`;

  await db.insert(aiAuditLogsTable).values({ userId: req.user!.id, event: "inference_request", requestSummary: `interview/evaluate`, responseStatus: "ok" });
  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Career analysis ──────────────────────────────────────────────────────────

router.post("/ai/career/analyze", requireAuth, async (req, res): Promise<void> => {
  const { resumeText, githubUrl, linkedinUrl, targetRole, currentLevel = "junior" } = req.body;
  if (!resumeText && !githubUrl) { res.status(400).json({ error: "Provide resumeText or githubUrl" }); return; }

  const check = sanitizeInput(resumeText ?? "");
  if (!check.safe) { res.status(400).json({ error: "Content blocked" }); return; }

  const system = renderPrompt("career", { userName: req.user!.name });
  const userMsg = `Analyse this ${currentLevel}-level developer's career profile targeting: ${targetRole ?? "software engineer role"}

${resumeText ? `**Resume:**\n${resumeText.slice(0, 2000)}` : ""}
${githubUrl ? `**GitHub:** ${githubUrl}` : ""}
${linkedinUrl ? `**LinkedIn:** ${linkedinUrl}` : ""}

Provide a detailed analysis covering:
1. **Profile Strength Score:** X/10
2. **Key Strengths**
3. **Critical Gaps** (skills/experience missing for target role)
4. **Resume Improvements** (3 specific changes)
5. **Technical Skills Roadmap** (top 3 skills to develop)
6. **6-Month Action Plan**
7. **Job Readiness:** Ready now / 3 months / 6 months`;

  await db.insert(aiAuditLogsTable).values({ userId: req.user!.id, event: "inference_request", requestSummary: `career/analyze: ${targetRole}`, responseStatus: "ok" });
  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Quiz generation ──────────────────────────────────────────────────────────

router.post("/ai/quiz/generate", requireAuth, async (req, res): Promise<void> => {
  const { topic, difficulty = "medium", count = 5, format = "mixed" } = req.body;
  if (!topic) { res.status(400).json({ error: "topic required" }); return; }

  const system = renderPrompt("quiz", { courseName: topic });
  const userMsg = `Generate ${count} ${difficulty} practice questions about: ${topic}
Format: ${format} (mixed = multiple choice, short answer, and coding)

For each question include:
- The question
- Answer options (if multiple choice, label A-D)
- Correct answer
- Brief explanation (1-2 sentences why it's correct)

Number the questions 1-${count}.`;

  await db.insert(aiAuditLogsTable).values({ userId: req.user!.id, event: "inference_request", requestSummary: `quiz/generate: ${topic} x${count}`, responseStatus: "ok" });
  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Content generation ───────────────────────────────────────────────────────

router.post("/ai/content/generate", requireAuth, requireRole("admin", "mentor"), async (req, res): Promise<void> => {
  const { type, topic, audience = "beginner", length = "medium" } = req.body;
  if (!type || !topic) { res.status(400).json({ error: "type and topic required" }); return; }

  const lengthGuide = { short: "~200 words", medium: "~500 words", long: "~1000 words" }[length] ?? "~500 words";
  const system = renderPrompt("general", {});
  const typePrompts: Record<string, string> = {
    summary: `Create a lesson summary (${lengthGuide}) on: ${topic}\nAudience: ${audience} learners\nInclude: key concepts, examples, and 3 takeaways`,
    flashcards: `Create 8-10 flashcards for: ${topic}\nFormat: **Front:** [concept] | **Back:** [explanation]\nAudience: ${audience}`,
    exercise: `Create a coding exercise for: ${topic}\nDifficulty: ${audience}\nInclude: problem statement, sample input/output, hints, solution`,
    notes: `Create revision notes (${lengthGuide}) for: ${topic}\nAudience: ${audience}\nFormat: structured with headers, bullet points, key terms highlighted`,
    challenge: `Create a coding challenge idea for: ${topic}\nInclude: title, description, learning objectives, difficulty (${audience}), sample test cases`,
  };

  const userMsg = typePrompts[type] ?? `Create ${type} content about ${topic} for ${audience} learners.`;
  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Personalised learning path ───────────────────────────────────────────────

router.post("/ai/learning/path", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { goalRole, timelineWeeks = 12, currentSkills = [] } = req.body;
  if (!goalRole) { res.status(400).json({ error: "goalRole required" }); return; }

  const system = renderPrompt("tutor", { userName: req.user!.name });
  const skillList = currentSkills.length > 0 ? currentSkills.join(", ") : "beginner level";
  const userMsg = `Create a ${timelineWeeks}-week personalised learning path for a student who wants to become a ${goalRole}.

Current skills: ${skillList}
Goal: ${goalRole}
Timeline: ${timelineWeeks} weeks

Structure:
- Week-by-week breakdown (group into phases)
- Key topics per phase
- Specific resources (types: videos, docs, practice projects)
- Milestones and checkpoints
- Final capstone project idea
- Success metrics`;

  res.json = undefined as any; // disable json — we stream
  await stream(res, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
});

// ─── Learning insights (skill gap analysis) ───────────────────────────────────

router.get("/ai/learning/insights", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const submissions = await db
    .select({
      challengeId: challengeSubmissionsTable.challengeId,
      status: challengeSubmissionsTable.status,
      score: challengeSubmissionsTable.score,
      language: challengeSubmissionsTable.language,
    })
    .from(challengeSubmissionsTable)
    .where(eq(challengeSubmissionsTable.studentId, userId))
    .orderBy(desc(challengeSubmissionsTable.submittedAt))
    .limit(100);

  const insights = generateLearningInsights(submissions, 0);
  res.json({ insights });
});

export default router;
