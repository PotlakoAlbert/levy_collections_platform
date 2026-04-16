import { Router, type IRouter } from "express";
import { db, documentsTable, mattersTable, debtorsTable, schemesTable, managingAgentsTable, interestRatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { ListDocumentsQueryParams, GenerateDocumentBody, BulkGenerateDocumentsBody, DownloadDocumentParams } from "@workspace/api-zod";
import { calculateInterest } from "../lib/interest";

const router: IRouter = Router();
router.use(authMiddleware);

const DOC_TYPE_LABELS: Record<string, string> = {
  LOD: "Letter of Demand",
  S129_NOTICE: "Section 129 Notice",
  SUMMONS: "Combined Summons",
  DEFAULT_JUDGMENT: "Default Judgment Application",
  WRIT: "Writ of Execution",
  RULE46_NOTICE: "Rule 46(1) Notice",
  JOINDER_NOTICE: "Section 15 STSMA Joinder Notice",
  PAYMENT_ARRANGEMENT: "Payment Arrangement Letter",
  STATEMENT: "Monthly Statement",
};

async function buildMergeFields(matterId: string) {
  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, matterId));
  if (!matter) return null;

  const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, matter.debtorId));
  const [scheme] = await db.select().from(schemesTable).where(eq(schemesTable.id, matter.schemeId));
  const agent = scheme ? (await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, scheme.agentId)))[0] : null;

  const capital = parseFloat(matter.capitalArrears);
  const costs = parseFloat(matter.legalCosts);
  const paid = parseFloat(matter.totalPaid);
  const fromDate = matter.interestFromDate ?? matter.lodDate ?? matter.createdAt;

  const { interest, rate, days, perDay } = await calculateInterest(capital, fromDate);
  const total = capital + interest + costs - paid;

  return {
    debtor_name: debtor ? `${debtor.firstName} ${debtor.lastName}` : "",
    debtor_address: debtor?.physicalAddress ?? "",
    debtor_id: debtor?.idNumber ?? "",
    scheme_name: scheme?.name ?? "",
    unit_number: matter.unit,
    levy_arrears: capital.toFixed(2),
    capital_arrears: capital.toFixed(2),
    interest_to_date: interest.toFixed(2),
    legal_costs: costs.toFixed(2),
    total_due: total.toFixed(2),
    interest_rate: `${(rate * 100).toFixed(2)}%`,
    interest_per_day: perDay.toFixed(2),
    reference: matter.reference,
    stage: matter.stage,
    lod_date: matter.lodDate?.toLocaleDateString("en-ZA") ?? "",
    s129_date: matter.s129Date?.toLocaleDateString("en-ZA") ?? "",
    court_name: "Johannesburg Magistrates' Court",
    case_number: matter.reference,
    agent_name: agent?.name ?? "",
    agent_email: agent?.contactEmail ?? "",
    interest_days: String(days),
    date_today: new Date().toLocaleDateString("en-ZA"),
  };
}

// Generate HTML document content
function generateDocumentHTML(docType: string, fields: Record<string, string>): string {
  const label = DOC_TYPE_LABELS[docType] ?? docType;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin: 2cm; color: #000; }
  h1 { font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 24px; }
  h2 { font-size: 13pt; font-weight: bold; }
  .header { text-align: right; margin-bottom: 24px; }
  .ref { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  td { padding: 4px 8px; }
  .amount { text-align: right; }
  .total { border-top: 2px solid #000; font-weight: bold; }
  .underline { text-decoration: underline; }
  .signature { margin-top: 48px; }
  p { margin: 8px 0; line-height: 1.6; }
</style>
</head>
<body>
<div class="header">
  <p>${fields.date_today}</p>
  <p class="ref">Ref: ${fields.reference}</p>
</div>

<h1>${label.toUpperCase()}</h1>

${docType === "LOD" ? `
<p>Dear ${fields.debtor_name}</p>
<p>RE: BODY CORPORATE OF ${fields.scheme_name} – SECTIONAL TITLE UNIT ${fields.unit_number}</p>

<p>We are attorneys acting on behalf of the Body Corporate of the abovementioned sectional title scheme. We are instructed to demand payment of the following levies and costs which are due and payable by you:</p>

<table>
  <tr><td>Capital Arrears:</td><td class="amount">R ${fields.capital_arrears}</td></tr>
  <tr><td>Interest to date (${fields.interest_rate} per annum – ${fields.interest_days} days @ R ${fields.interest_per_day}/day):</td><td class="amount">R ${fields.interest_to_date}</td></tr>
  <tr><td>Legal Costs:</td><td class="amount">R ${fields.legal_costs}</td></tr>
  <tr class="total"><td>TOTAL DUE:</td><td class="amount">R ${fields.total_due}</td></tr>
</table>

<p>You are hereby DEMANDED to pay the total sum of <strong>R ${fields.total_due}</strong> within 10 (ten) business days of receipt of this letter, failing which legal proceedings will be instituted against you without further notice.</p>

<p>This letter also constitutes a Section 129(1) notice in terms of the National Credit Act 34 of 2005.</p>

<p>Yours faithfully,</p>
<div class="signature">
  <p>_________________________</p>
  <p>ATTORNEYS</p>
</div>
` : docType === "S129_NOTICE" ? `
<p>To: ${fields.debtor_name}<br/>${fields.debtor_address}</p>

<p><strong>NOTICE IN TERMS OF SECTION 129(1)(a) OF THE NATIONAL CREDIT ACT 34 OF 2005</strong></p>

<p>RE: BODY CORPORATE OF ${fields.scheme_name} – UNIT ${fields.unit_number}</p>
<p>ACCOUNT REFERENCE: ${fields.reference}</p>

<p>We hereby notify you in terms of Section 129(1)(a) of the National Credit Act 34 of 2005 that you are in default under the credit agreement and we are required to notify you of the options available to you:</p>

<ol>
  <li>Contact our offices to discuss ways to resolve the arrears;</li>
  <li>Refer the matter to a debt counsellor, alternative dispute resolution agent, consumer court, or ombud with jurisdiction;</li>
  <li>If you do not respond within 10 (ten) business days of this notice, we will proceed to enforce our rights.</li>
</ol>

<p>Amount in arrears: <strong>R ${fields.total_due}</strong></p>
` : `
<p>Matter: ${fields.reference}</p>
<p>Debtor: ${fields.debtor_name}</p>
<p>Scheme: ${fields.scheme_name}, Unit ${fields.unit_number}</p>

<p>Capital Arrears: R ${fields.capital_arrears}</p>
<p>Interest: R ${fields.interest_to_date}</p>
<p>Legal Costs: R ${fields.legal_costs}</p>
<p><strong>Total Outstanding: R ${fields.total_due}</strong></p>
`}

</body>
</html>`;
}

router.get("/documents", async (req, res): Promise<void> => {
  const qp = ListDocumentsQueryParams.safeParse(req.query);
  let docs = await db.select().from(documentsTable).orderBy(documentsTable.createdAt);

  if (qp.success && qp.data.matterId) {
    docs = docs.filter((d) => d.matterId === qp.data.matterId);
  }

  const [matter] = qp.success && qp.data.matterId
    ? await db.select().from(mattersTable).where(eq(mattersTable.id, qp.data.matterId!))
    : [null];

  res.json(
    docs.map((d) => ({
      id: d.id,
      matterId: d.matterId,
      matterReference: matter?.reference ?? null,
      docType: d.docType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      generatedByName: null,
      sentVia: d.sentVia ?? null,
      sentAt: d.sentAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }))
  );
});

router.post("/documents/generate", async (req, res): Promise<void> => {
  const parsed = GenerateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const fields = await buildMergeFields(parsed.data.matterId);
  if (!fields) {
    res.status(400).json({ error: "Matter not found" });
    return;
  }

  const docLabel = DOC_TYPE_LABELS[parsed.data.docType] ?? parsed.data.docType;
  const fileName = `${fields.reference}_${parsed.data.docType}_${Date.now()}.html`;
  const htmlContent = generateDocumentHTML(parsed.data.docType, fields);
  const fileUrl = `data:text/html;base64,${Buffer.from(htmlContent).toString("base64")}`;

  const [doc] = await db.insert(documentsTable).values({
    matterId: parsed.data.matterId,
    docType: parsed.data.docType,
    fileName,
    fileUrl,
    generatedById: req.user!.id,
  }).returning();

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, parsed.data.matterId));

  res.status(201).json({
    id: doc.id,
    matterId: doc.matterId,
    matterReference: matter?.reference ?? null,
    docType: doc.docType,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    generatedByName: null,
    sentVia: null,
    sentAt: null,
    createdAt: doc.createdAt.toISOString(),
  });
});

router.post("/documents/bulk-generate", async (req, res): Promise<void> => {
  const parsed = BulkGenerateDocumentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const results: Array<{id: string; matterId: string; matterReference: string | null; docType: string; fileName: string; fileUrl: string; generatedByName: null; sentVia: null; sentAt: null; createdAt: string}> = [];
  const errors: string[] = [];

  for (const matterId of parsed.data.matterIds) {
    try {
      const fields = await buildMergeFields(matterId);
      if (!fields) {
        errors.push(`Matter ${matterId} not found`);
        continue;
      }

      const fileName = `${fields.reference}_${parsed.data.docType}_${Date.now()}.html`;
      const htmlContent = generateDocumentHTML(parsed.data.docType, fields);
      const fileUrl = `data:text/html;base64,${Buffer.from(htmlContent).toString("base64")}`;

      const [doc] = await db.insert(documentsTable).values({
        matterId,
        docType: parsed.data.docType,
        fileName,
        fileUrl,
        generatedById: req.user!.id,
      }).returning();

      const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, matterId));

      results.push({
        id: doc.id,
        matterId: doc.matterId,
        matterReference: matter?.reference ?? null,
        docType: doc.docType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        generatedByName: null,
        sentVia: null,
        sentAt: null,
        createdAt: doc.createdAt.toISOString(),
      });
    } catch (err) {
      errors.push(`Failed to generate document for matter ${matterId}`);
    }
  }

  res.json({
    generated: results.length,
    failed: errors.length,
    documents: results,
    errors,
  });
});

router.get("/documents/:id/download", async (req, res): Promise<void> => {
  const params = DownloadDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, params.data.id));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  res.json({
    url: doc.fileUrl,
    fileName: doc.fileName,
    expiresAt,
  });
});

export default router;
