import { Router } from "express";
import reportsRouter from "./reports.js";
import suspensionsRouter from "./suspensions.js";
import auditLogsRouter from "./audit-logs.js";

const moderationRouter = Router();

moderationRouter.use(reportsRouter);
moderationRouter.use(suspensionsRouter);
moderationRouter.use(auditLogsRouter);

export default moderationRouter;
