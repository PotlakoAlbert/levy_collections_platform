import { db, botConversationStatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitToDebtor } from "./ws";

export interface AutomationSettings {
  automationEnabled: boolean;
  botAutoReplyEnabled: boolean;
}

export interface PendingBotDraft {
  messageText: string;
  intent: string;
  debtorPhone: string;
  createdAt: string;
}

export interface BotContext extends AutomationSettings {
  pendingDraft?: PendingBotDraft | null;
  lastIntent?: string;
  confidence?: number;
  nextAction?: string | null;
  escalationReason?: string | null;
  messageId?: string;
}

const DEFAULT_SETTINGS: AutomationSettings = {
  automationEnabled: true,
  botAutoReplyEnabled: true,
};

function parseContext(raw: string | null): BotContext {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<BotContext>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      automationEnabled: parsed.automationEnabled ?? true,
      botAutoReplyEnabled: parsed.botAutoReplyEnabled ?? true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function getAutomationSettings(matterId: string): Promise<AutomationSettings & { pendingDraft: PendingBotDraft | null }> {
  const [state] = await db
    .select()
    .from(botConversationStatesTable)
    .where(eq(botConversationStatesTable.matterId, matterId));

  const ctx = parseContext(state?.context ?? null);
  return {
    automationEnabled: ctx.automationEnabled,
    botAutoReplyEnabled: ctx.botAutoReplyEnabled,
    pendingDraft: ctx.pendingDraft ?? null,
  };
}

export async function updateAutomationSettings(
  matterId: string,
  debtorId: string,
  updates: Partial<AutomationSettings>
): Promise<AutomationSettings & { pendingDraft: PendingBotDraft | null }> {
  const [existing] = await db
    .select()
    .from(botConversationStatesTable)
    .where(eq(botConversationStatesTable.matterId, matterId));

  const ctx = parseContext(existing?.context ?? null);
  const next: BotContext = {
    ...ctx,
    ...updates,
  };

  if (!existing) {
    await db.insert(botConversationStatesTable).values({
      matterId,
      debtorId,
      state: "INITIAL",
      context: JSON.stringify(next),
      messageCount: "0",
    });
  } else {
    await db
      .update(botConversationStatesTable)
      .set({ context: JSON.stringify(next) })
      .where(eq(botConversationStatesTable.matterId, matterId));
  }

  try {
    emitToDebtor(debtorId, "automation_settings", {
      matterId,
      automationEnabled: next.automationEnabled,
      botAutoReplyEnabled: next.botAutoReplyEnabled,
    });
  } catch {
    /* ignore ws failures */
  }

  return {
    automationEnabled: next.automationEnabled,
    botAutoReplyEnabled: next.botAutoReplyEnabled,
    pendingDraft: next.pendingDraft ?? null,
  };
}

export async function setPendingBotDraft(
  matterId: string,
  debtorId: string,
  draft: PendingBotDraft
): Promise<void> {
  const [existing] = await db
    .select()
    .from(botConversationStatesTable)
    .where(eq(botConversationStatesTable.matterId, matterId));

  const ctx = parseContext(existing?.context ?? null);
  const next: BotContext = { ...ctx, pendingDraft: draft };

  if (!existing) {
    await db.insert(botConversationStatesTable).values({
      matterId,
      debtorId,
      state: "AWAITING_RESPONSE",
      context: JSON.stringify(next),
      messageCount: "0",
    });
  } else {
    await db
      .update(botConversationStatesTable)
      .set({ context: JSON.stringify(next) })
      .where(eq(botConversationStatesTable.matterId, matterId));
  }

  try {
    emitToDebtor(debtorId, "bot_draft", { matterId, draft, debtorId });
  } catch {
    /* ignore */
  }
}

export async function clearPendingBotDraft(matterId: string, debtorId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(botConversationStatesTable)
    .where(eq(botConversationStatesTable.matterId, matterId));

  if (!existing?.context) return;

  const ctx = parseContext(existing.context);
  const next: BotContext = { ...ctx, pendingDraft: null };

  await db
    .update(botConversationStatesTable)
    .set({ context: JSON.stringify(next) })
    .where(eq(botConversationStatesTable.matterId, matterId));

  try {
    emitToDebtor(debtorId, "bot_draft", { matterId, draft: null, debtorId });
  } catch {
    /* ignore */
  }
}

export async function isAutomationEnabled(matterId: string): Promise<boolean> {
  const settings = await getAutomationSettings(matterId);
  return settings.automationEnabled;
}

export async function isBotAutoReplyEnabled(matterId: string): Promise<boolean> {
  const settings = await getAutomationSettings(matterId);
  return settings.botAutoReplyEnabled;
}
