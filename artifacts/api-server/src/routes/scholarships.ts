import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, scholarshipApplicationsTable, usersTable, notificationsTable } from "@workspace/db";
import {
  ListScholarshipApplicationsQueryParams,
  CreateScholarshipApplicationBody,
  ReviewScholarshipApplicationBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

async function withApplicant(a: typeof scholarshipApplicationsTable.$inferSelect) {
  const [applicant] = await db.select().from(usersTable).where(eq(usersTable.id, a.applicantUserId));
  return { ...a, applicantName: applicant?.name ?? "", applicantEmail: applicant?.email ?? "" };
}

router.get(
  "/scholarship-applications",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const query = ListScholarshipApplicationsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const rows = await db
      .select()
      .from(scholarshipApplicationsTable)
      .where(query.data.status ? eq(scholarshipApplicationsTable.status, query.data.status) : undefined)
      .orderBy(desc(scholarshipApplicationsTable.appliedAt));
    res.json(await Promise.all(rows.map(withApplicant)));
  },
);

router.post("/scholarship-applications", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateScholarshipApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [application] = await db
    .insert(scholarshipApplicationsTable)
    .values({ ...parsed.data, applicantUserId: req.user!.id })
    .returning();
  res.status(201).json(await withApplicant(application));
});

router.get("/scholarship-applications/me", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(scholarshipApplicationsTable)
    .where(eq(scholarshipApplicationsTable.applicantUserId, req.user!.id))
    .orderBy(desc(scholarshipApplicationsTable.appliedAt));
  res.json(await Promise.all(rows.map(withApplicant)));
});

router.get("/scholarship-applications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [application] = await db
    .select()
    .from(scholarshipApplicationsTable)
    .where(eq(scholarshipApplicationsTable.id, id));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  if (application.applicantUserId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(await withApplicant(application));
});

router.patch(
  "/scholarship-applications/:id/review",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = ReviewScholarshipApplicationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [application] = await db
      .update(scholarshipApplicationsTable)
      .set({
        status: parsed.data.status,
        reviewNotes: parsed.data.reviewNotes,
        reviewerId: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(scholarshipApplicationsTable.id, id))
      .returning();
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    await db.insert(notificationsTable).values({
      userId: application.applicantUserId,
      type: "scholarship_review",
      title: `Scholarship application ${parsed.data.status}`,
      body:
        parsed.data.status === "approved"
          ? "Congratulations! Your scholarship application has been approved."
          : "Your scholarship application was not approved this time.",
      link: "/scholarship",
    });
    res.json(await withApplicant(application));
  },
);

export default router;
