import { Router } from "express";
import chatRouter from "./chat.js";
import codeRouter from "./code.js";
import toolsRouter from "./tools.js";
import knowledgeRouter from "./knowledge.js";
import adminRouter from "./admin.js";
import analyticsRouter from "./analytics.js";
import personalizationRouter from "./personalization.js";
import { aiRateLimit } from "../../middlewares/aiRateLimit.js";

const router = Router();
// Applies to all /ai/* routes except admin (admins are exempt — they need
// unthrottled access to manage models/prompts and run eval suites).
router.use(/^\/ai\/(?!admin)/, aiRateLimit());
router.use(chatRouter);
router.use(codeRouter);
router.use(toolsRouter);
router.use(knowledgeRouter);
router.use(adminRouter);
router.use(analyticsRouter);
router.use(personalizationRouter);

export default router;
