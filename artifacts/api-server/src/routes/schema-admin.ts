import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, matterAssigneesTable, autoAdvanceRulesTable, botConversationStatesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ============= MATTER ASSIGNEES ROUTES =============

/**
 * Get all assignees for a matter
 * GET /api/matter-assignees/:matterId
 */
router.get("/matter-assignees/:matterId", async (req, res) => {
  try {
    const { matterId } = req.params;

    const assignees = await db
      .select()
      .from(matterAssigneesTable)
      .where(and(
        eq(matterAssigneesTable.matterId, matterId),
        eq(matterAssigneesTable.unassignedAt, null as any)
      ));

    res.json(assignees);
  } catch (error) {
    logger.error({ err: error }, "Error fetching matter assignees");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Assign a user to a matter
 * POST /api/matter-assignees
 */
router.post("/matter-assignees", async (req, res) => {
  try {
    const { matterId, userId, role, notes } = req.body;
    const assignedById = req.user?.id;

    if (!matterId || !userId || !assignedById) {
      res.status(400).json({ error: "matterId, userId, and authorization required" });
      return;
    }

    const [assignee] = await db
      .insert(matterAssigneesTable)
      .values({
        matterId,
        userId,
        role: role || "COLLECTOR",
        assignedById,
        notes: notes || null,
      })
      .returning();

    logger.info({ matterId, userId, assignedById }, "Matter assignee created");
    res.status(201).json(assignee);
  } catch (error) {
    logger.error({ err: error }, "Error creating matter assignee");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Unassign a user from a matter
 * PATCH /api/matter-assignees/:id/unassign
 */
router.patch("/matter-assignees/:id/unassign", async (req, res) => {
  try {
    const { id } = req.params;

    const [assignee] = await db
      .update(matterAssigneesTable)
      .set({ unassignedAt: new Date() })
      .where(eq(matterAssigneesTable.id, id))
      .returning();

    if (!assignee) {
      res.status(404).json({ error: "Assignee not found" });
      return;
    }

    logger.info({ assigneeId: id }, "Matter assignee unassigned");
    res.json(assignee);
  } catch (error) {
    logger.error({ err: error }, "Error unassigning matter assignee");
    res.status(500).json({ error: String(error) });
  }
});

// ============= AUTO ADVANCE RULES ROUTES =============

/**
 * Get all auto-advance rules
 * GET /api/auto-advance-rules
 */
router.get("/auto-advance-rules", async (req, res) => {
  try {
    const rules = await db.select().from(autoAdvanceRulesTable);
    res.json(rules);
  } catch (error) {
    logger.error({ err: error }, "Error fetching auto-advance rules");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get rules for a specific stage transition
 * GET /api/auto-advance-rules/:fromStage/:toStage
 */
router.get("/auto-advance-rules/:fromStage/:toStage", async (req, res) => {
  try {
    const { fromStage, toStage } = req.params;

    const rules = await db
      .select()
      .from(autoAdvanceRulesTable)
      .where(
        and(
          eq(autoAdvanceRulesTable.fromStage, fromStage),
          eq(autoAdvanceRulesTable.toStage, toStage),
          eq(autoAdvanceRulesTable.enabled, true)
        )
      );

    res.json(rules);
  } catch (error) {
    logger.error({ err: error }, "Error fetching auto-advance rules for stage transition");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Create an auto-advance rule
 * POST /api/auto-advance-rules
 */
router.post("/auto-advance-rules", async (req, res) => {
  try {
    const { fromStage, toStage, conditionDays, condition, description } = req.body;

    if (!fromStage || !toStage || !conditionDays || !condition) {
      res.status(400).json({ error: "fromStage, toStage, conditionDays, condition required" });
      return;
    }

    const [rule] = await db
      .insert(autoAdvanceRulesTable)
      .values({
        fromStage,
        toStage,
        conditionDays,
        condition,
        description: description || null,
      })
      .returning();

    logger.info({ fromStage, toStage, conditionDays }, "Auto-advance rule created");
    res.status(201).json(rule);
  } catch (error) {
    logger.error({ err: error }, "Error creating auto-advance rule");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Update an auto-advance rule
 * PATCH /api/auto-advance-rules/:id
 */
router.patch("/auto-advance-rules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, conditionDays, description } = req.body;

    const updates: Record<string, any> = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (conditionDays !== undefined) updates.conditionDays = conditionDays;
    if (description !== undefined) updates.description = description;

    const [rule] = await db
      .update(autoAdvanceRulesTable)
      .set(updates)
      .where(eq(autoAdvanceRulesTable.id, id))
      .returning();

    if (!rule) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    logger.info({ ruleId: id }, "Auto-advance rule updated");
    res.json(rule);
  } catch (error) {
    logger.error({ err: error }, "Error updating auto-advance rule");
    res.status(500).json({ error: String(error) });
  }
});

// ============= BOT CONVERSATION STATE ROUTES =============

/**
 * Get bot conversation state for a matter
 * GET /api/bot-states/:matterId
 */
router.get("/bot-states/:matterId", async (req, res) => {
  try {
    const { matterId } = req.params;

    const [state] = await db
      .select()
      .from(botConversationStatesTable)
      .where(eq(botConversationStatesTable.matterId, matterId));

    if (!state) {
      res.status(404).json({ error: "Bot state not found" });
      return;
    }

    res.json(state);
  } catch (error) {
    logger.error({ err: error }, "Error fetching bot conversation state");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Create or initialize bot conversation state
 * POST /api/bot-states
 */
router.post("/bot-states", async (req, res) => {
  try {
    const { matterId, debtorId, state, context } = req.body;

    if (!matterId || !debtorId) {
      res.status(400).json({ error: "matterId and debtorId required" });
      return;
    }

    const [botState] = await db
      .insert(botConversationStatesTable)
      .values({
        matterId,
        debtorId,
        state: state || "INITIAL",
        context: context ? JSON.stringify(context) : null,
        lastMessageAt: null,
      })
      .returning();

    logger.info({ matterId, debtorId }, "Bot conversation state created");
    res.status(201).json(botState);
  } catch (error) {
    logger.error({ err: error }, "Error creating bot conversation state");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Update bot conversation state
 * PATCH /api/bot-states/:matterId
 */
router.patch("/bot-states/:matterId", async (req, res) => {
  try {
    const { matterId } = req.params;
    const { state, context, lastMessageAt, escalationReason } = req.body;

    const updates: Record<string, any> = {};
    if (state !== undefined) updates.state = state;
    if (context !== undefined) updates.context = JSON.stringify(context);
    if (lastMessageAt !== undefined) updates.lastMessageAt = lastMessageAt ? new Date(lastMessageAt) : null;
    if (escalationReason !== undefined) updates.escalationReason = escalationReason;
    updates.updatedAt = new Date();

    const [botState] = await db
      .update(botConversationStatesTable)
      .set(updates)
      .where(eq(botConversationStatesTable.matterId, matterId))
      .returning();

    if (!botState) {
      res.status(404).json({ error: "Bot state not found" });
      return;
    }

    logger.info({ matterId, newState: state }, "Bot conversation state updated");
    res.json(botState);
  } catch (error) {
    logger.error({ err: error }, "Error updating bot conversation state");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Mark bot conversation as escalated
 * PATCH /api/bot-states/:matterId/escalate
 */
router.patch("/bot-states/:matterId/escalate", async (req, res) => {
  try {
    const { matterId } = req.params;
    const { reason } = req.body;

    const [botState] = await db
      .update(botConversationStatesTable)
      .set({
        state: "ESCALATED",
        escalationReason: reason || "Manual escalation",
        updatedAt: new Date(),
      })
      .where(eq(botConversationStatesTable.matterId, matterId))
      .returning();

    if (!botState) {
      res.status(404).json({ error: "Bot state not found" });
      return;
    }

    logger.info({ matterId, reason }, "Bot conversation escalated");
    res.json(botState);
  } catch (error) {
    logger.error({ err: error }, "Error escalating bot conversation");
    res.status(500).json({ error: String(error) });
  }
});

export default router;
