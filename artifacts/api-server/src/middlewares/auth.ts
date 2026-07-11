import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { logger } from "../lib/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Ensures the current Clerk session maps to a local `users` row, creating one
 * on first sight (JIT provisioning). The very first user ever provisioned
 * becomes an admin so there is always someone able to manage the platform;
 * everyone after that defaults to student unless promoted or unless Clerk's
 * publicMetadata.role says otherwise.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);

    if (existing) {
      req.user = existing;
      next();
      return;
    }

    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email ||
      "New User";
    const metadataRole = clerkUser.publicMetadata?.role;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);
    const role =
      count === 0
        ? ("admin" as const)
        : metadataRole === "mentor" || metadataRole === "admin"
          ? metadataRole
          : ("student" as const);

    const [created] = await db
      .insert(usersTable)
      .values({
        clerkId,
        email,
        name,
        role,
        avatarUrl: clerkUser.imageUrl,
      })
      .onConflictDoNothing({ target: usersTable.clerkId })
      .returning();

    const user =
      created ??
      (
        await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkId, clerkId))
          .limit(1)
      )[0];

    req.user = user;
    next();
  } catch (err) {
    logger.error({ err }, "Failed to resolve authenticated user");
    next(err);
  }
}

export function requireRole(...roles: Array<User["role"]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
