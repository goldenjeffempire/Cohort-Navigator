import { Router } from "express";
import configRouter from "./config.js";

const integrationsRouter = Router();

integrationsRouter.use(configRouter);

export default integrationsRouter;
