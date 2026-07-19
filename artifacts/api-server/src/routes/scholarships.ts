import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, scholarshipApplicationsTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

async function withApplicant(a: typeof scholarshipApplicationsTable.$inferSelect) {
  const [applicant] = await db.select().from(usersTable).where(eq(usersTable.id, a.applicantUserId));
  return { ...a, applicantName: applicant?.name ?? "", applicantEmail: applicant?.email ?? "" };
}

function generateId(prefix: string): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${year}-${random}`;
}

// ── Zod schemas ────────────────────────────────────────────────────────────

const CreateApplicationBody = z.object({
  // Personal
  fullName: z.string().min(1),
  email: z.string().email(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  // Education
  highestQualification: z.string().optional(),
  institution: z.string().optional(),
  courseOfStudy: z.string().optional(),
  graduationYear: z.string().optional(),
  // Professional
  employmentStatus: z.string().optional(),
  technicalExperience: z.string().optional(),
  programmingExperience: z.string().optional(),
  aiExperience: z.string().optional(),
  previousProjects: z.string().optional(),
  portfolioUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  resumeUrl: z.string().optional(),
  // Scholarship
  essay: z.string().optional(),
  careerGoals: z.string().optional(),
  motivationLetter: z.string().optional(),
  availability: z.string().optional(),
  hasInternetAccess: z.boolean().optional(),
  hasComputer: z.boolean().optional(),
  preferredTrack: z.string().optional(),
  cohortId: z.number().int().positive().optional(),
  // Agreements
  agreedToCodeOfConduct: z.boolean().optional(),
  agreedToScholarshipAgreement: z.boolean().optional(),
  agreedToPrivacyPolicy: z.boolean().optional(),
  agreedToTerms: z.boolean().optional(),
  // Allow saving as draft
  status: z.enum(["draft", "pending"]).optional(),
});

const ListQueryParams = z.object({
  status: z
    .enum([
      "draft",
      "pending",
      "under_review",
      "additional_info_requested",
      "probation",
      "probation_assessment",
      "fully_admitted",
      "not_admitted",
    ])
    .optional(),
});

const AdvanceStatusBody = z.object({
  status: z.enum([
    "under_review",
    "additional_info_requested",
    "probation",
    "probation_assessment",
    "fully_admitted",
    "not_admitted",
  ]),
  reviewNotes: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  assessmentScore: z.number().int().min(0).max(100).optional(),
  cohortId: z.number().int().positive().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────

// List all (admin)
router.get("/scholarship-applications", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const query = ListQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const rows = await db
    .select()
    .from(scholarshipApplicationsTable)
    .where(query.data.status ? eq(scholarshipApplicationsTable.status, query.data.status) : undefined)
    .orderBy(desc(scholarshipApplicationsTable.appliedAt));
  res.json(await Promise.all(rows.map(withApplicant)));
});

// Submit / save draft
router.post("/scholarship-applications", requireAuth, async (req, res): Promise<void> => {
  // Block if user already has a non-draft application
  const [existing] = await db
    .select()
    .from(scholarshipApplicationsTable)
    .where(eq(scholarshipApplicationsTable.applicantUserId, req.user!.id))
    .orderBy(desc(scholarshipApplicationsTable.appliedAt))
    .limit(1);

  if (existing && existing.status !== "draft" && existing.status !== "not_admitted") {
    res.status(409).json({ error: "You already have an active application." });
    return;
  }

  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const status = parsed.data.status ?? "pending";

  if (existing && existing.status === "draft") {
    // Update the existing draft
    const [updated] = await db
      .update(scholarshipApplicationsTable)
      .set({ ...parsed.data, status, appliedAt: status === "pending" ? new Date() : existing.appliedAt })
      .where(eq(scholarshipApplicationsTable.id, existing.id))
      .returning();
    res.status(200).json(await withApplicant(updated));
    return;
  }

  const [application] = await db
    .insert(scholarshipApplicationsTable)
    .values({ ...parsed.data, applicantUserId: req.user!.id, status })
    .returning();
  res.status(201).json(await withApplicant(application));
});

// My applications
router.get("/scholarship-applications/me", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(scholarshipApplicationsTable)
    .where(eq(scholarshipApplicationsTable.applicantUserId, req.user!.id))
    .orderBy(desc(scholarshipApplicationsTable.appliedAt));
  res.json(await Promise.all(rows.map(withApplicant)));
});

// Get single
router.get("/scholarship-applications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [application] = await db.select().from(scholarshipApplicationsTable).where(eq(scholarshipApplicationsTable.id, id));
  if (!application) { res.status(404).json({ error: "Not found" }); return; }
  if (application.applicantUserId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  res.json(await withApplicant(application));
});

// Advance through workflow (admin)
router.patch("/scholarship-applications/:id/advance", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdvanceStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [application] = await db.select().from(scholarshipApplicationsTable).where(eq(scholarshipApplicationsTable.id, id));
  if (!application) { res.status(404).json({ error: "Not found" }); return; }

  const now = new Date();
  const updateData: Partial<typeof scholarshipApplicationsTable.$inferInsert> = {
    status: parsed.data.status,
    reviewerId: req.user!.id,
    reviewedAt: now,
    reviewNotes: parsed.data.reviewNotes ?? application.reviewNotes,
  };

  if (parsed.data.score !== undefined) updateData.score = parsed.data.score;
  if (parsed.data.cohortId !== undefined) updateData.cohortId = parsed.data.cohortId;

  let notificationTitle = "";
  let notificationBody = "";

  switch (parsed.data.status) {
    case "under_review":
      notificationTitle = "Application Under Review";
      notificationBody = "Your scholarship application is now being actively reviewed by our team.";
      break;

    case "additional_info_requested":
      notificationTitle = "Additional Information Required";
      notificationBody = "Our team needs additional information about your application. Please check the notes.";
      break;

    case "probation": {
      // Generate probation ID and grant probation access
      const probationId = generateId("PROB");
      const probationStart = now;
      const probationEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
      updateData.probationStartDate = probationStart;
      updateData.probationEndDate = probationEnd;

      // Update user to probation_student role and set probation ID
      await db
        .update(usersTable)
        .set({ role: "probation_student", probationId })
        .where(eq(usersTable.id, application.applicantUserId));

      notificationTitle = "🎉 Probation Admission — Welcome!";
      notificationBody = `Congratulations! You've been admitted to the probation period. Your Probation ID is ${probationId}. Complete the 1-week programme and pass the assessment to gain full admission.`;
      break;
    }

    case "probation_assessment":
      if (parsed.data.assessmentScore !== undefined) {
        updateData.assessmentScore = parsed.data.assessmentScore;
        updateData.assessmentCompletedAt = now;
      }
      notificationTitle = "Probation Assessment Unlocked";
      notificationBody = "Your probation period is complete. The admission assessment is now available.";
      break;

    case "fully_admitted": {
      // Generate student ID and grant full access
      const studentId = generateId("JOE");
      await db
        .update(usersTable)
        .set({ role: "student", studentId })
        .where(eq(usersTable.id, application.applicantUserId));

      notificationTitle = "🎓 Fully Admitted — Welcome to JOE Hub!";
      notificationBody = `Congratulations! You have been fully admitted to JOE Hub. Your Student ID is ${studentId}. All courses, projects, and community features are now unlocked.`;
      break;
    }

    case "not_admitted": {
      const assessmentScore = parsed.data.assessmentScore ?? application.assessmentScore;
      if (assessmentScore !== undefined) updateData.assessmentScore = assessmentScore;
      // Revert role to student (basic access)
      await db.update(usersTable).set({ role: "student" }).where(eq(usersTable.id, application.applicantUserId));
      notificationTitle = "Application Update";
      notificationBody = `Thank you for going through our admission process. Unfortunately, you did not meet the passing score of 70% required for full admission. Please review the feedback and consider reapplying in the future.`;
      break;
    }
  }

  const [updated] = await db
    .update(scholarshipApplicationsTable)
    .set(updateData)
    .where(eq(scholarshipApplicationsTable.id, id))
    .returning();

  if (notificationTitle) {
    await db.insert(notificationsTable).values({
      userId: application.applicantUserId,
      type: "scholarship_review",
      title: notificationTitle,
      body: notificationBody,
      link: "/scholarship/status",
    });
  }

  res.json(await withApplicant(updated));
});

// Legacy review endpoint (kept for backwards-compat — maps to advance)
router.patch("/scholarship-applications/:id/review", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({
    status: z.enum(["approved", "rejected"]),
    reviewNotes: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Map legacy approved→fully_admitted, rejected→not_admitted
  const newStatus = parsed.data.status === "approved" ? "fully_admitted" : "not_admitted";
  req.body = { status: newStatus, reviewNotes: parsed.data.reviewNotes };

  // Delegate to advance handler via internal redirect equivalent
  const advanceParsed = AdvanceStatusBody.safeParse(req.body);
  if (!advanceParsed.success) { res.status(400).json({ error: advanceParsed.error.message }); return; }

  const [application] = await db.select().from(scholarshipApplicationsTable).where(eq(scholarshipApplicationsTable.id, id));
  if (!application) { res.status(404).json({ error: "Not found" }); return; }

  const updateData: Partial<typeof scholarshipApplicationsTable.$inferInsert> = {
    status: newStatus,
    reviewerId: req.user!.id,
    reviewedAt: new Date(),
    reviewNotes: parsed.data.reviewNotes ?? application.reviewNotes,
  };

  if (newStatus === "fully_admitted") {
    const studentId = generateId("JOE");
    await db.update(usersTable).set({ role: "student", studentId }).where(eq(usersTable.id, application.applicantUserId));
  }

  const [updated] = await db
    .update(scholarshipApplicationsTable)
    .set(updateData)
    .where(eq(scholarshipApplicationsTable.id, id))
    .returning();

  const title = newStatus === "fully_admitted" ? "🎓 Fully Admitted — Welcome to JOE Hub!" : "Application Update";
  const body = newStatus === "fully_admitted"
    ? "Congratulations! You have been fully admitted to JOE Hub."
    : "Thank you for applying. Unfortunately, we cannot offer you admission at this time.";

  await db.insert(notificationsTable).values({
    userId: application.applicantUserId,
    type: "scholarship_review",
    title,
    body,
    link: "/scholarship/status",
  });

  res.json(await withApplicant(updated));
});

export default router;
