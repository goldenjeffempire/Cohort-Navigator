import { Router } from "express";
import conversationsRouter from "./conversations.js";
import messagesRouter from "./messages.js";
import presenceRouter from "./presence.js";

const messagingRouter = Router();

messagingRouter.use(conversationsRouter);
messagingRouter.use(messagesRouter);
messagingRouter.use(presenceRouter);

export default messagingRouter;
