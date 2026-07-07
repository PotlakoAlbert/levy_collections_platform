import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import agentsRouter from "./agents";
import schemesRouter from "./schemes";
import debtorsRouter from "./debtors";
import mattersRouter from "./matters";
import documentsRouter from "./documents";
import paymentsRouter from "./payments";
import tasksRouter from "./tasks";
import reportsRouter from "./reports";
import adminRouter from "./admin";
import publicRouter from "./public";
import postingCodesRouter from "./posting-codes";
import transactionsRouter from "./transactions";
import creditorsRouter from "./creditors";
import requisitionsRouter from "./requisitions";
import communicationsRouter from "./communications";
import schemaAdminRouter from "./schema-admin";
import whatsappRouter from "./whatsapp";
import testAutomationsRouter from "./test-automations";

const router: IRouter = Router();

// Public / demo routes first — routers below use blanket authMiddleware which
// would otherwise block every later-mounted route when no token is present.
router.use("/health", healthRouter);
router.use(healthRouter);
router.use(whatsappRouter);
router.use(testAutomationsRouter);
router.use(publicRouter);

router.use(authRouter);
router.use(usersRouter);
router.use(agentsRouter);
router.use(schemesRouter);
router.use(debtorsRouter);
router.use(mattersRouter);
router.use(documentsRouter);
router.use(paymentsRouter);
router.use(tasksRouter);
router.use(postingCodesRouter);
router.use(transactionsRouter);
router.use(creditorsRouter);
router.use(requisitionsRouter);
router.use(communicationsRouter);
router.use(reportsRouter);
router.use(adminRouter); // Phase 7: Admin Dashboard
router.use(schemaAdminRouter); // Phase 2: Schema administration

export default router;
