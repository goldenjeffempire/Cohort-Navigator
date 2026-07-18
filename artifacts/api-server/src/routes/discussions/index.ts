import { Router } from "express";
import threadsRouter from "./threads.js";
import postsRouter from "./posts.js";
import reactionsRouter from "./reactions.js";

const discussionsRouter = Router();

discussionsRouter.use(threadsRouter);
discussionsRouter.use(postsRouter);
discussionsRouter.use(reactionsRouter);

export default discussionsRouter;
