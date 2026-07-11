/**
 * Code similarity detection using token-based Jaccard similarity.
 *
 * Algorithm:
 * 1. Normalize code (strip comments, collapse whitespace, lowercase)
 * 2. Tokenize into n-grams of tokens
 * 3. Compute Jaccard similarity: |A ∩ B| / |A ∪ B|
 * 4. Flag pairs with similarity ≥ 0.70 as potential plagiarism
 */

const FLAG_THRESHOLD = 0.70;
const NGRAM_SIZE = 5;

// ─── Normalization ────────────────────────────────────────────────────────────

function stripComments(code: string): string {
  // Remove // line comments
  let s = code.replace(/\/\/[^\n]*/g, " ");
  // Remove /* */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Remove # line comments (Python / Bash)
  s = s.replace(/#[^\n]*/g, " ");
  return s;
}

function normalize(code: string): string {
  return stripComments(code)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize into individual words/operators */
function tokenize(code: string): string[] {
  return normalize(code)
    .split(/[\s,;{}()\[\]]+/)
    .filter(Boolean);
}

/** Build a set of n-grams from a token array */
function buildNGrams(tokens: string[], n: number): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    grams.add(tokens.slice(i, i + n).join(" "));
  }
  // Also include single tokens for short submissions
  tokens.forEach((t) => grams.add(t));
  return grams;
}

// ─── Similarity ───────────────────────────────────────────────────────────────

export function computeSimilarity(code1: string, code2: string): number {
  const t1 = tokenize(code1);
  const t2 = tokenize(code2);

  // Very short submissions are unreliable — don't flag
  if (t1.length < 10 || t2.length < 10) return 0;

  const g1 = buildNGrams(t1, NGRAM_SIZE);
  const g2 = buildNGrams(t2, NGRAM_SIZE);

  let intersection = 0;
  for (const g of g1) {
    if (g2.has(g)) intersection++;
  }

  const union = g1.size + g2.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

export function shouldFlag(similarity: number): boolean {
  return similarity >= FLAG_THRESHOLD;
}

/** Compare all submissions for a challenge, return pairwise similarity scores */
export interface SimilarityPair {
  submission1Id: number;
  submission2Id: number;
  student1Name: string;
  student2Name: string;
  similarityScore: number;
  flagged: boolean;
}

export function compareManySubmissions(
  submissions: Array<{
    id: number;
    code: string;
    studentName: string;
  }>,
): SimilarityPair[] {
  const pairs: SimilarityPair[] = [];

  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const score = computeSimilarity(submissions[i].code, submissions[j].code);
      pairs.push({
        submission1Id: submissions[i].id,
        submission2Id: submissions[j].id,
        student1Name: submissions[i].studentName,
        student2Name: submissions[j].studentName,
        similarityScore: Math.round(score * 100) / 100,
        flagged: shouldFlag(score),
      });
    }
  }

  return pairs.sort((a, b) => b.similarityScore - a.similarityScore);
}
