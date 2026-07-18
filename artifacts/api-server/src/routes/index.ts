import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import cohortsRouter from "./cohorts";
import coursesRouter from "./courses";
import modulesRouter from "./modules";
import lessonsRouter from "./lessons";
import assignmentsRouter from "./assignments";
import quizzesRouter from "./quizzes";
import announcementsRouter from "./announcements";
import notificationsRouter from "./notifications";
import scholarshipsRouter from "./scholarships";
import dashboardRouter from "./dashboard";
// Phase 3 — coding workspace & assessment
import executeRouter from "./execute";
import challengesRouter from "./challenges";
import submissionsRouter from "./submissions";
import codingRouter from "./coding";
import plagiarismRouter from "./plagiarism";
// Phase 4 — native AI platform
import aiRouter from "./ai/index";
import storageRouter from "./storage";
// Phase 5 — collaboration, mentorship & community
import communityRouter from "./community/index.js";
import discussionsRouter from "./discussions/index.js";
import mentorshipRouter from "./mentorship/index.js";
import teamRouter from "./teams/index.js";
import moderationRouter from "./moderation/index.js";
import messagingRouter from "./messaging/index.js";
import liveRouter from "./live-learning/index.js";
import integrationsRouter from "./integrations/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(cohortsRouter);
router.use(coursesRouter);
router.use(modulesRouter);
router.use(lessonsRouter);
router.use(assignmentsRouter);
router.use(quizzesRouter);
router.use(announcementsRouter);
router.use(notificationsRouter);
router.use(scholarshipsRouter);
router.use(dashboardRouter);
// Phase 3
router.use(executeRouter);
router.use(challengesRouter);
router.use(submissionsRouter);
router.use(codingRouter);
router.use(plagiarismRouter);
// Phase 4
router.use(aiRouter);
router.use(storageRouter);
// Phase 5
router.use(communityRouter);
router.use(discussionsRouter);
router.use(mentorshipRouter);
router.use(teamRouter);
router.use(moderationRouter);
router.use(messagingRouter);
router.use(liveRouter);
router.use(integrationsRouter);

export default router;
