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

export default router;
