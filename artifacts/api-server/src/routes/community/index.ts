import { Router } from "express";
import communitiesRouter from "./communities.js";
import badgesRouter from "./badges.js";
import leaderboardRouter from "./leaderboard.js";

const communityRouter = Router();

communityRouter.use(communitiesRouter);
communityRouter.use(badgesRouter);
communityRouter.use(leaderboardRouter);

export default communityRouter;
