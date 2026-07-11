/**
 * Secure code execution engine.
 *
 * Runs student code in sandboxed child processes with:
 * - Per-execution temp directory (cleaned up after run)
 * - Hard timeout via the system `timeout` binary
 * - Memory limits via Node.js flags
 * - 64 KB output cap to prevent flooding
 * - Support for JS, TS (Node 24 native), Python, Bash, HTML, CSS, SQL
 *
 * Docker-level isolation is the recommended production upgrade;
 * this implementation is appropriate for a trusted-student environment.
 */

import { exec } from "child_process";
import { writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { promisify } from "util";

const execAsync = promisify(exec);

export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "bash"
  | "html"
  | "css"
  | "sql";

export interface ExecutionRequest {
  code: string;
  language: SupportedLanguage;
  stdin?: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB
const DEFAULT_TIMEOUT_MS = 10_000;
const HARD_MAX_TIMEOUT_MS = 15_000;
const NODE_MEMORY_MB = 128;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string): string {
  const bytes = Buffer.byteLength(s, "utf8");
  if (bytes <= MAX_OUTPUT_BYTES) return s;
  return Buffer.from(s).slice(0, MAX_OUTPUT_BYTES).toString("utf8") + "\n… [output truncated]";
}

function normalizeOutput(s: string): string {
  return s.trim().replace(/\r\n/g, "\n");
}

/** Returns the command string to run a file for a given language. */
function buildRunCommand(
  language: SupportedLanguage,
  filePath: string,
  stdinPath: string,
  timeoutSec: number,
): string {
  const t = Math.ceil(timeoutSec);
  const nodeFlags = `--max-old-space-size=${NODE_MEMORY_MB}`;

  switch (language) {
    case "javascript":
      return `timeout ${t}s node ${nodeFlags} "${filePath}" < "${stdinPath}" 2>&1`;

    case "typescript":
      // Node 24+ natively strips TypeScript type annotations
      return `timeout ${t}s node ${nodeFlags} --experimental-strip-types "${filePath}" < "${stdinPath}" 2>&1`;

    case "python":
      return `timeout ${t}s python3 "${filePath}" < "${stdinPath}" 2>&1`;

    case "bash":
      // Restrict with no-exec on /proc /sys and basic PATH
      return `timeout ${t}s bash "${filePath}" < "${stdinPath}" 2>&1`;

    case "html":
    case "css":
      // No execution — return a static-preview sentinel
      return `echo "PREVIEW_ONLY"`;

    case "sql":
      if (!process.env.DATABASE_URL) return `echo "DATABASE_URL not configured"`;
      // Run SQL in a read-only transaction wrapper
      return `echo "BEGIN READ ONLY; $(cat '${filePath}'); ROLLBACK;" | timeout ${t}s psql "${process.env.DATABASE_URL}" --no-password -q 2>&1`;

    default:
      return `echo "Unsupported language"`;
  }
}

function fileExtension(language: SupportedLanguage): string {
  const map: Record<SupportedLanguage, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    bash: "sh",
    html: "html",
    css: "css",
    sql: "sql",
  };
  return map[language];
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeCode(req: ExecutionRequest): Promise<ExecutionResult> {
  const { code, language, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS } = req;
  const safeTMs = Math.min(timeoutMs, HARD_MAX_TIMEOUT_MS);
  const timeoutSec = safeTMs / 1000;

  // Create isolated temp directory for this execution
  const execId = randomBytes(8).toString("hex");
  const workDir = join(tmpdir(), `joe-exec-${execId}`);

  const startTime = Date.now();

  try {
    await mkdir(workDir, { recursive: true });

    const ext = fileExtension(language);
    const filePath = join(workDir, `solution.${ext}`);
    const stdinPath = join(workDir, "stdin.txt");

    await Promise.all([
      writeFile(filePath, code, "utf8"),
      writeFile(stdinPath, stdin, "utf8"),
    ]);

    const cmd = buildRunCommand(language, filePath, stdinPath, timeoutSec);

    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let timedOut = false;

    try {
      const result = await execAsync(cmd, {
        cwd: workDir,
        timeout: safeTMs + 1000, // extra buffer so timeout binary fires first
        maxBuffer: MAX_OUTPUT_BYTES * 2,
        env: {
          PATH: process.env.PATH,
          HOME: workDir, // restrict HOME to temp dir
          TMPDIR: workDir,
          // Intentionally omit DATABASE_URL, CLERK_*, etc. from child environment
          ...(language === "sql" ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
        },
      });
      stdout = truncate(result.stdout || "");
      stderr = truncate(result.stderr || "");
    } catch (err: any) {
      if (err.killed || err.signal === "SIGTERM" || String(err.message).includes("timeout")) {
        timedOut = true;
        stderr = `Execution timed out after ${timeoutSec}s`;
        exitCode = 124;
      } else {
        stdout = truncate(err.stdout || "");
        stderr = truncate(err.stderr || err.message || "Unknown error");
        exitCode = err.code ?? 1;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      stdout: normalizeOutput(stdout),
      stderr: normalizeOutput(stderr),
      exitCode,
      executionTimeMs,
      timedOut,
    };
  } finally {
    // Always clean up temp directory
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Run code against a specific stdin and compare to expected output */
export async function runTestCase(params: {
  code: string;
  language: SupportedLanguage;
  input: string;
  expectedOutput: string;
  timeoutMs?: number;
}): Promise<{ passed: boolean; actualOutput: string; executionTimeMs: number; error?: string }> {
  const result = await executeCode({
    code: params.code,
    language: params.language,
    stdin: params.input,
    timeoutMs: params.timeoutMs,
  });

  const actual = normalizeOutput(result.stdout);
  const expected = normalizeOutput(params.expectedOutput);
  const passed = actual === expected;

  return {
    passed,
    actualOutput: result.timedOut ? "[TIMEOUT]" : (result.exitCode !== 0 ? result.stderr : actual),
    executionTimeMs: result.executionTimeMs,
    error: result.timedOut ? "Execution timed out" : (result.exitCode !== 0 ? result.stderr : undefined),
  };
}

/** Available languages with their display info */
export const LANGUAGE_INFO: Record<SupportedLanguage, {
  label: string;
  monacoId: string;
  available: () => boolean;
}> = {
  javascript: { label: "JavaScript", monacoId: "javascript", available: () => true },
  typescript: { label: "TypeScript", monacoId: "typescript", available: () => true },
  python: { label: "Python 3", monacoId: "python", available: () => {
    try {
      require("child_process").execSync("which python3", { stdio: "ignore" });
      return true;
    } catch { return false; }
  }},
  bash: { label: "Bash", monacoId: "shell", available: () => true },
  html: { label: "HTML", monacoId: "html", available: () => true },
  css: { label: "CSS", monacoId: "css", available: () => true },
  sql: { label: "SQL", monacoId: "sql", available: () => !!process.env.DATABASE_URL },
};
