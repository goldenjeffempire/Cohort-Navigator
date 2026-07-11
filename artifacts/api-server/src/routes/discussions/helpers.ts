import { eq, and } from "drizzle-orm";
import { db, communityMembersTable } from "@workspace/db";
import type { User } from "@workspace/db";

/**
 * Returns true if the user is a moderator or admin of the given community,
 * OR if they are a platform-level admin (bypasses community check).
 */
export async function isCommunityModOrAdmin(
  user: User,
  communityId: number,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const [membership] = await db
    .select({ role: communityMembersTable.role })
    .from(communityMembersTable)
    .where(
      and(
        eq(communityMembersTable.userId, user.id),
        eq(communityMembersTable.communityId, communityId),
      ),
    )
    .limit(1);
  return membership?.role === "moderator" || membership?.role === "admin";
}
