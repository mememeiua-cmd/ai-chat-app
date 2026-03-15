import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import githubRouter from "./github";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(githubRouter);

export default router;
