/**
 * AI abuse / rate limiting.
 *
 * In-memory per-user sliding window, mirroring the pattern already used for
 * code execution (see routes/execute.ts). Every block is written to
 * ai_audit_logs as a `rate_limit_hit` event so admins can see abuse patterns
 * in the AI admin dashboard (GET /api/ai/admin/audit).
 *
 * Self-hosted note: this runs entirely in the API server process — no
 * external rate-limiting service (e.g. Redis-backed SaaS) is required for
 * the platform's current scale. If the API server is horizontally scaled
 * across multiple instances, swap the Map for a shared store (Postgres or
 * Redis) — see docs/ai/security.md.
 */
import type { Request, Response, NextFunction } from "express";
import { db, aiAuditLogsTable } from "@workspace/db";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

const buckets = new Map<number, { count: number; resetAt: number }>();

export function aiRateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) { next(); return; }

    const now = Date.now();
    const entry = buckets.get(userId);

    if (!entry || now > entry.resetAt) {
      buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
      next();
      return;
    }

    if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
      await db.insert(aiAuditLogsTable).values({
        userId,
        event: "rate_limit_hit",
        requestSummary: `${req.method} ${req.path}`,
        responseStatus: "blocked",
        flagReason: "rate_limit_exceeded",
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      });
      res.status(429).json({ error: "AI rate limit exceeded. Please wait a minute before trying again." });
      return;
    }

    entry.count++;
    next();
  };
}
