/**
 * Retrieval-Augmented Response Engine
 *
 * When no external model is configured, this engine:
 *  1. Retrieves relevant knowledge chunks via BM25
 *  2. Fills a structured response template per conversation mode
 *  3. Returns a helpful, context-grounded answer
 */

import { db, aiKnowledgeChunksTable } from "@workspace/db";
import { like, or, sql } from "drizzle-orm";

// ─── BM25 text search ─────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function bm25Score(doc: string, query: string[], k1 = 1.5, b = 0.75): number {
  const docTokens = tokenize(doc);
  const docLen = docTokens.length;
  const avgLen = 200; // approximate
  let score = 0;
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const term of query) {
    const f = tf.get(term) ?? 0;
    if (f === 0) continue;
    const idf = Math.log(1 + (1000 - 1 + 0.5) / (1 + 1)); // simplified
    const num = f * (k1 + 1);
    const den = f + k1 * (1 - b + b * (docLen / avgLen));
    score += idf * (num / den);
  }
  return score;
}

export async function searchKnowledge(query: string, limit = 5): Promise<Array<{ id: number; title: string; content: string; score: number }>> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  // Fetch candidate chunks that contain any query term (Postgres ILIKE)
  const conditions = terms.slice(0, 5).map((t) =>
    or(like(aiKnowledgeChunksTable.content, `%${t}%`), like(aiKnowledgeChunksTable.title, `%${t}%`)),
  );

  const candidates = await db
    .select({
      id: aiKnowledgeChunksTable.id,
      title: aiKnowledgeChunksTable.title,
      content: aiKnowledgeChunksTable.content,
    })
    .from(aiKnowledgeChunksTable)
    .where(or(...conditions))
    .limit(50);

  // Re-rank with BM25
  const scored = candidates.map((c) => ({
    ...c,
    score: bm25Score(c.content + " " + c.title, terms),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ─── Response templates by mode ───────────────────────────────────────────────

const MODE_PREAMBLES: Record<string, string> = {
  tutor: "As your AI learning assistant, here's what I can share:",
  code: "Let me analyze this code for you:",
  assignment: "Here's guidance on your assignment:",
  interview: "Great question! Here's how I'd approach this interview scenario:",
  career: "Based on your profile and goals, here's my career guidance:",
  quiz: "Here are some practice questions to test your understanding:",
  review: "Here's my review of the submitted work:",
  general: "Here's what I found:",
};

function buildContextSection(chunks: Array<{ title: string; content: string }>): string {
  if (chunks.length === 0) return "";
  const items = chunks
    .slice(0, 3)
    .map((c) => `**${c.title}**\n${c.content.slice(0, 300)}${c.content.length > 300 ? "…" : ""}`)
    .join("\n\n");
  return `\n\n---\n*Relevant course material:*\n\n${items}`;
}

function detectMode(systemPrompt: string): string {
  const sp = systemPrompt.toLowerCase();
  if (sp.includes("code") || sp.includes("programming")) return "code";
  if (sp.includes("assignment")) return "assignment";
  if (sp.includes("interview")) return "interview";
  if (sp.includes("career") || sp.includes("resume")) return "career";
  if (sp.includes("quiz") || sp.includes("question")) return "quiz";
  if (sp.includes("review")) return "review";
  if (sp.includes("tutor") || sp.includes("explain") || sp.includes("teach")) return "tutor";
  return "general";
}

// ─── Core response generator ──────────────────────────────────────────────────

export const retrievalEngine = {
  async generateResponse(
    userMessage: string,
    systemPrompt: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const mode = detectMode(systemPrompt);
    const preamble = MODE_PREAMBLES[mode] ?? MODE_PREAMBLES.general;

    // Retrieve relevant knowledge
    const chunks = await searchKnowledge(userMessage, 4);
    const contextSection = buildContextSection(chunks);

    // Generate structured response based on what the user is asking
    const q = userMessage.toLowerCase();
    let body = "";

    if (mode === "code" || q.includes("code") || q.includes("function") || q.includes("error") || q.includes("bug")) {
      body = generateCodeResponse(userMessage, chunks);
    } else if (mode === "quiz" || q.includes("quiz") || q.includes("practice question")) {
      body = generateQuizResponse(userMessage);
    } else if (mode === "interview" || q.includes("interview")) {
      body = generateInterviewResponse(userMessage);
    } else if (mode === "career" || q.includes("career") || q.includes("resume") || q.includes("job")) {
      body = generateCareerResponse(userMessage);
    } else {
      body = generateTutorResponse(userMessage, chunks);
    }

    return `${preamble}\n\n${body}${contextSection}`;
  },
};

// ─── Specialised generators ───────────────────────────────────────────────────

function generateCodeResponse(query: string, chunks: Array<{ title: string; content: string }>): string {
  const q = query.toLowerCase();
  if (q.includes("explain") || q.includes("what does") || q.includes("how does")) {
    return `I can help explain this code.\n\n**Key concepts to look for:**\n- Variable declarations and data flow\n- Function signatures and return types\n- Control flow (loops, conditionals)\n- Data structures being used\n\nTo give you a precise explanation, please paste the code snippet you'd like me to explain and I'll walk through it step by step.\n\n**Tip:** Break down complex code into smaller logical sections to understand it better.`;
  }
  if (q.includes("bug") || q.includes("error") || q.includes("fix")) {
    return `Let me help you debug this.\n\n**Common debugging steps:**\n1. **Read the error message carefully** — it usually points to the exact line and issue\n2. **Check variable types** — many bugs come from unexpected types (null, undefined, wrong type)\n3. **Verify your logic flow** — add console.log/print statements to trace execution\n4. **Check edge cases** — empty arrays, zero values, null inputs\n5. **Review recent changes** — if it worked before, what changed?\n\nPaste your code and error message and I'll analyse it specifically.`;
  }
  if (q.includes("optimis") || q.includes("optim") || q.includes("performance")) {
    return `Here are code optimisation strategies:\n\n**Algorithmic improvements:**\n- Replace O(n²) nested loops with hash maps (O(n))\n- Use binary search instead of linear search on sorted data\n- Cache repeated computations (memoisation)\n\n**Language-specific tips:**\n- Avoid unnecessary object creation inside loops\n- Use appropriate data structures (Set for lookups, Map for key-value)\n- Batch database queries instead of N+1 loops\n\n**Measurement first:**\nAlways profile before optimising — measure where the bottleneck actually is.`;
  }
  return `I can help with your code question.\n\nPlease share:\n1. The code you're working with\n2. What you expect it to do\n3. What it's actually doing (or any error messages)\n\nWith that context, I can give you specific, actionable guidance.`;
}

function generateTutorResponse(query: string, chunks: Array<{ title: string; content: string }>): string {
  const q = query.toLowerCase();
  if (q.includes("explain") || q.includes("what is") || q.includes("how")) {
    const topic = query.replace(/^(explain|what is|how does|what are|define)\s+/i, "").replace(/[?]$/, "");
    return `Great question about **${topic}**!\n\nHere's how I'd explain it:\n\n**Core concept:**\nThis is a fundamental concept in programming/computing. Let me break it down into digestible parts.\n\n**Why it matters:**\nUnderstanding this will help you write better, more efficient code and solve problems more effectively.\n\n**Practical application:**\nTry applying this concept in your current exercises — practice is the best way to solidify understanding.\n\n**Next steps:**\n- Review the related lesson materials\n- Attempt the practice challenges\n- Ask follow-up questions if anything is unclear\n\nWhat specific aspect would you like me to elaborate on?`;
  }
  if (q.includes("help") || q.includes("stuck") || q.includes("don't understand")) {
    return `I'm here to help! Let's work through this together.\n\n**Tell me more:**\n- Which specific concept or problem are you stuck on?\n- What have you tried so far?\n- What part is confusing?\n\nThe more context you give me, the more targeted my help can be. Don't worry — getting stuck is a normal part of learning!`;
  }
  return `I'm your AI learning assistant for JOE Hub.\n\nI can help you with:\n- **Explaining concepts** from your courses\n- **Debugging code** and finding errors\n- **Answering questions** about programming topics\n- **Practice problems** to test your knowledge\n- **Learning recommendations** based on your progress\n\nWhat would you like to explore today?`;
}

function generateQuizResponse(query: string): string {
  return `Here are some practice questions to test your understanding:\n\n**Question 1 (Conceptual):**\nExplain the difference between a compiled and interpreted programming language. Give one example of each.\n\n**Question 2 (Application):**\nGiven an array \`[3, 1, 4, 1, 5, 9, 2, 6]\`, write a function that returns the two largest unique numbers.\n\n**Question 3 (Analysis):**\nWhat is the time complexity of a binary search algorithm, and why is it more efficient than linear search for sorted arrays?\n\n**Question 4 (True/False):**\nIn most programming languages, arrays are zero-indexed. True or False? Explain your reasoning.\n\n**Bonus Challenge:**\nWrite a function that checks whether a string is a palindrome without using built-in reverse methods.\n\n---\n*Take your time with each question. When you're ready, share your answers and I'll provide detailed feedback!*`;
}

function generateInterviewResponse(query: string): string {
  return `Let me help you prepare for technical interviews.\n\n**Common technical interview question:**\n\n*"Tell me about a challenging bug you encountered and how you debugged it."*\n\n**Strong answer structure (STAR method):**\n- **Situation:** Briefly describe the project context\n- **Task:** What were you trying to achieve?\n- **Action:** Step-by-step how you debugged it\n- **Result:** What was the outcome? What did you learn?\n\n**Tips for coding interviews:**\n1. Think out loud — interviewers want to see your problem-solving process\n2. Clarify requirements before coding\n3. Start with a brute-force solution, then optimise\n4. Test your solution with edge cases\n5. Discuss time and space complexity\n\n**Practice prompt:**\nTry answering: *"Implement a function that finds the first non-repeated character in a string."*\n\nShare your solution and I'll give you detailed feedback!`;
}

function generateCareerResponse(query: string): string {
  return `Here's personalised career guidance for software developers:\n\n**Building a strong technical profile:**\n\n1. **GitHub Portfolio**\n   - Maintain active repositories with clear READMEs\n   - Show diversity: web apps, algorithms, open-source contributions\n   - Use consistent commit messages and branching strategies\n\n2. **Resume essentials**\n   - Lead with measurable achievements, not responsibilities\n   - Include tech stack, project impact, and scale\n   - Keep it to 1 page for < 5 years experience\n\n3. **LinkedIn optimisation**\n   - Complete profile with a professional photo\n   - Write a compelling headline (not just "Student")\n   - Request endorsements for key skills\n\n4. **Technical skills roadmap**\n   - Master 1-2 languages deeply before expanding\n   - Learn fundamentals: DSA, system design, databases\n   - Build real projects that solve real problems\n\n**Next steps:**\nShare your current resume or GitHub profile URL for a personalised review!`;
}
