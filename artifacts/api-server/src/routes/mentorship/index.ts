import { Router } from "express";
import profilesRouter from "./profiles.js";
import availabilityRouter from "./availability.js";
import sessionsRouter from "./sessions.js";
import feedbackRouter from "./feedback.js";

const mentorshipRouter = Router();

mentorshipRouter.use(profilesRouter);
mentorshipRouter.use(availabilityRouter);
mentorshipRouter.use(sessionsRouter);
mentorshipRouter.use(feedbackRouter);

export default mentorshipRouter;
