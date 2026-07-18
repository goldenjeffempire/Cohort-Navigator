import { Router } from "express";
import sessionsRouter from "./sessions.js";
import rsvpsRouter from "./rsvps.js";

const liveRouter = Router();

liveRouter.use(sessionsRouter);
liveRouter.use(rsvpsRouter);

export default liveRouter;
