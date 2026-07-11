import { Router } from "express";
import chatRouter from "./chat.js";
import codeRouter from "./code.js";
import toolsRouter from "./tools.js";
import knowledgeRouter from "./knowledge.js";
import adminRouter from "./admin.js";

const router = Router();
router.use(chatRouter);
router.use(codeRouter);
router.use(toolsRouter);
router.use(knowledgeRouter);
router.use(adminRouter);

export default router;
