import { Router } from "express";
import teamsRouter from "./teams.js";
import membersRouter from "./members.js";
import tasksRouter from "./tasks.js";
import resourcesRouter from "./resources.js";
import invitationsRouter from "./invitations.js";

const teamRouter = Router();

teamRouter.use(teamsRouter);
teamRouter.use(membersRouter);
teamRouter.use(tasksRouter);
teamRouter.use(resourcesRouter);
teamRouter.use(invitationsRouter);

export default teamRouter;
