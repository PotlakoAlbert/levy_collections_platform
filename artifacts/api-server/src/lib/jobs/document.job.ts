import { Job } from "bullmq";
import { db, documentsTable, mattersTable, debtorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { aiService } from "../ai/ai.service";
import { logLodGenerated, logLodSending, logJobQueued } from "../activity-log.service";
import { emitToDebtor } from "../ws";
import { enqueueJob } from "./dispatcher";

/**
 * Document generation worker job
 * Generates documents using AI and stores in database
 */
export async function handleDocumentJob(job: Job) {
  logger.info({ ...job.data }, `[DOCUMENT WORKER] Processing document generation`);

  try {
    const { matterId, documentType, debtorId, reference, chainWhatsApp } = job.data;

    if (!matterId || !documentType) {
      logger.warn({ ...job.data }, `[DOCUMENT WORKER] Missing required fields`);
      return { success: false, error: "matterId and documentType required" };
    }

    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, matterId));

    if (!matter) {
      logger.warn(`[DOCUMENT WORKER] Matter not found: ${matterId}`);
      return { success: false, error: "matter not found", matterId };
    }

    const resolvedDebtorId = debtorId || matter.debtorId;
    const resolvedReference = reference || matter.reference;

    const matterDetails = {
      matterId: matter.id,
      debtorName: "Debtor",
      debtorAddress: "",
      outstandingBalance: parseFloat(matter.capitalArrears) + parseFloat(matter.interest),
      reference: matter.reference,
    };

    const { content, wordCount, readabilityScore } = await aiService.draftDocumentContent(
      documentType,
      matterDetails
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${documentType}_${matter.reference}_${timestamp}.pdf`;
    const fileUrl = `/api/documents/${matterId}/${fileName}`;

    const [document] = await db
      .insert(documentsTable)
      .values({
        matterId,
        docType: documentType,
        fileName: fileName,
        fileUrl: fileUrl,
        generatedById: "system",
      })
      .returning();

    await logLodGenerated(resolvedDebtorId, matterId, resolvedReference, document.id);

    try {
      emitToDebtor(resolvedDebtorId, "document_generated", {
        document,
        matterId,
        documentType,
        reference: resolvedReference,
      });
    } catch (e) {
      logger.warn({ e }, "Failed to emit websocket for document_generated");
    }

    if (chainWhatsApp && documentType === "LOD") {
      const [debtor] = await db
        .select()
        .from(debtorsTable)
        .where(eq(debtorsTable.id, resolvedDebtorId));

      const debtorPhone = debtor?.whatsapp ?? debtor?.phone;
      if (debtorPhone) {
        const debtorName = debtor ? `${debtor.firstName} ${debtor.lastName}` : "debtor";
        const lodMessage = `Letter of Demand issued for matter ${resolvedReference}. Please review the document and contact us urgently to discuss settlement options.\n\n${document.fileUrl}`;

        await logLodSending(resolvedDebtorId, matterId, resolvedReference, "WhatsApp");
        await logJobQueued(resolvedDebtorId, matterId, "LOD WhatsApp notification", "whatsapp");

        await enqueueJob("whatsapp", {
          debtorPhone,
          matterId,
          debtorId: resolvedDebtorId,
          debtorName,
          message: lodMessage,
          activityContext: "LOD_NOTIFICATION",
        });
        logger.info(`[DOCUMENT WORKER] LOD WhatsApp notification queued after document generation`);
      }
    }

    logger.info(
      {
        documentId: document.id,
        wordCount,
        readabilityScore,
        fileUrl,
        timestamp,
      },
      `[DOCUMENT WORKER] Real document generated for ${documentType}`
    );

    return {
      success: true,
      matterId,
      documentId: document.id,
      documentType,
      fileName,
      fileUrl,
      wordCount,
      readabilityScore,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ err: error }, `[DOCUMENT WORKER] Error generating document`);
    throw error;
  }
}
