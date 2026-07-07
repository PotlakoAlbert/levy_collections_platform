/**
 * AI Service Layer
 * Integrates with free AI services (DeepSeek or Gemini) for:
 * - Debtor intent classification from messages
 * - Document content drafting
 * - Stage advancement recommendations
 * - Payment arrangement negotiation
 *
 * Supports two providers:
 * 1. Gemini (Google) - Free tier: 60 calls/min, no credit card needed
 * 2. DeepSeek - Free credits: ~$5 startup, ~$0.005 per 1M tokens
 *
 * Environment Variables (optional, uses mock if not set):
 * - AI_PROVIDER: "gemini" or "deepseek" (default: "mock" for testing)
 * - GEMINI_API_KEY: Get from https://makersuite.google.com/app/apikey
 * - DEEPSEEK_API_KEY: Get from https://platform.deepseek.com
 * - DEEPSEEK_BASE_URL: https://api.deepseek.com
 */

import { logger } from "../logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type DebtorIntent =
  | "PAYMENT_OFFER"
  | "NEGOTIATION_REQUEST"
  | "DISPUTE_CLAIM"
  | "INSUFFICIENT_FUNDS"
  | "PAYMENT_AGREED"
  | "BLOCKED_CONTACT"
  | "LEGAL_THREAT"
  | "UNKNOWN";

export interface IntentClassificationResult {
  intent: DebtorIntent;
  confidence: number; // 0-1
  reasoning: string;
  suggestedResponse: string;
}

export interface DocumentDraftResult {
  content: string;
  wordCount: number;
  readabilityScore: number; // 0-100
  warnings: string[];
}

export interface StageAdvancementRecommendation {
  shouldAdvance: boolean;
  nextStage: string | null;
  confidence: number; // 0-1
  reasoning: string;
  riskFactors: string[];
  timelineRecommendation: string;
}

export interface PaymentArrangementResult {
  proposedAmount: number;
  proposedFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  proposedDuration: number; // months
  totalPayable: number;
  riskAssessment: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  negotiationTips: string[];
}

// ============================================================================
// AI SERVICE CLASS
// ============================================================================

class AIService {
  private readonly provider: "gemini" | "deepseek" | "mock";
  private readonly geminiApiKey: string | null;
  private readonly deepseekApiKey: string | null;
  private readonly deepseekBaseUrl: string;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || null;
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || null;
    this.deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    this.provider = this.resolveProvider();

    logger.info(
      {
        provider: this.provider,
        hasGeminiKey: !!this.geminiApiKey,
        hasDeepseekKey: !!this.deepseekApiKey,
      },
      "AI Service initialized"
    );
  }

  private resolveProvider(): "gemini" | "deepseek" | "mock" {
    const preferred = process.env.AI_PROVIDER as "gemini" | "deepseek" | "mock" | undefined;
    if (preferred === "gemini" || preferred === "deepseek" || preferred === "mock") {
      return preferred;
    }
    if (this.deepseekApiKey) return "deepseek";
    if (this.geminiApiKey) return "gemini";
    
    // Production should not default to mock
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      logger.error(
        "No AI provider configured for production. Set DEEPSEEK_API_KEY or GEMINI_API_KEY and AI_PROVIDER env vars"
      );
    }
    
    return "mock";
  }

  /**
   * FUNCTION 1: Classify Debtor Intent
   * Analyzes a debtor's message to determine their intent
   *
   * Example:
   * Input: "I can only pay R200 next month, my salary comes then"
   * Output: Intent=PAYMENT_OFFER, confidence=0.95, suggestedResponse="Negotiate on amount"
   */
  async classifyDebtorIntent(
    message: string,
    matterContext?: {
      debtorName?: string;
      outstandingBalance?: number;
      previousOffers?: string[];
      stage?: string;
    }
  ): Promise<IntentClassificationResult> {
    try {
      if (this.provider === "mock") {
        const mockRes = this.mockClassifyDebtorIntent(message, matterContext);
        try {
          console.log("LLM raw result (mock):", JSON.stringify(mockRes));
        } catch (e) {
          /* ignore */
        }
        logger.info({ provider: this.provider, raw: mockRes }, "LLM raw result (mock)");
        return mockRes;
      }

      const prompt = `Analyze this debtor's message and classify their intent:

Message: "${message}"
${matterContext?.debtorName ? `Debtor: ${matterContext.debtorName}` : ""}
${matterContext?.outstandingBalance ? `Outstanding: R${matterContext.outstandingBalance}` : ""}
${matterContext?.stage ? `Collection Stage: ${matterContext.stage}` : ""}

Respond ONLY in this JSON format:
{
  "intent": "PAYMENT_OFFER|NEGOTIATION_REQUEST|DISPUTE_CLAIM|INSUFFICIENT_FUNDS|PAYMENT_AGREED|BLOCKED_CONTACT|LEGAL_THREAT|UNKNOWN",
  "confidence": 0.95,
  "reasoning": "Clear statement of payment ability",
  "suggestedResponse": "Negotiate terms and lock in arrangement"
}`;

      const result =
        this.provider === "gemini"
          ? await this.callGemini(prompt)
          : await this.callDeepseek(prompt);

      // Log raw LLM output for debugging/inspection
      try {
        console.log("LLM raw result:", result);
      } catch (e) {
        /* ignore */
      }
      logger.info({ provider: this.provider, rawResult: result }, "LLM raw output");

      // Try strict JSON parse first, then fallback to extracting JSON substring,
      // then finally attempt a simple key/value heuristic parser for messy LLM output.
      let parsed: any = null;
      try {
        parsed = JSON.parse(result);
      } catch (err) {
        // Attempt to extract a JSON substring
        const jsonMatch = (result || "").match(/\{[\s\S]*\}/m);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (err2) {
            parsed = null;
          }
        }

        // Final fallback: simple regex-based key:value extraction
        if (!parsed) {
          const intentMatch = (result || "").match(/intent\s*[:=]\s*(?:"([A-Z_]+)"|([A-Z_]+))/i);
          const confMatch = (result || "").match(/confidence\s*[:=]\s*([0-9.]+)/i);
          const suggestedMatch = (result || "").match(/suggestedResponse\s*[:=]\s*(?:"([^"]+)"|'([^']+)'|([^\n\r]+))/i);

          parsed = {
            intent: intentMatch ? (intentMatch[1] || intentMatch[2]) : "UNKNOWN",
            confidence: confMatch ? parseFloat(confMatch[1]) : 0.5,
            reasoning: (result || "").substring(0, 100),
            suggestedResponse: suggestedMatch
              ? (suggestedMatch[1] || suggestedMatch[2] || (suggestedMatch[3] || "")).trim()
              : "Review manually",
          };
          logger.warn({ provider: this.provider, raw: result }, "LLM returned non-JSON output; used heuristic parser");
        }
      }

      try {
        try {
          console.log("Parsed LLM classification:", JSON.stringify(parsed));
        } catch (e) {
          /* ignore */
        }
        logger.info({ provider: this.provider, parsed }, "Parsed LLM classification result");
      } catch (e) {
        /* ignore logging errors */
      }

      return {
        intent: parsed.intent || "UNKNOWN",
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || "Unable to determine",
        suggestedResponse: parsed.suggestedResponse || "Review manually",
      };
    } catch (error) {
      logger.warn(
        {
          errorMessage: error instanceof Error ? error.message : String(error),
          message,
        },
        "AI intent classification failed — falling back to mock classifier"
      );
      return this.mockClassifyDebtorIntent(message, matterContext);
    }
  }

  /**
   * FUNCTION 2: Draft Document Content
   * Generates professional document content using AI
   *
   * Example:
   * Input: docType="LOD", matterId="/2026/0042"
   * Output: Full Letter of Demand with proper legal language
   */
  async draftDocumentContent(
    docType: string,
    matterDetails: {
      matterId: string;
      debtorName: string;
      debtorAddress: string;
      outstandingBalance: number;
      dueDate?: string;
      reference?: string;
      originalCreditor?: string;
    }
  ): Promise<DocumentDraftResult> {
    try {
      if (this.provider === "mock") {
        return this.mockDraftDocumentContent(docType, matterDetails);
      }

      const prompt = `Draft a professional legal ${docType} document for South African debt collection.

Details:
- Matter ID: ${matterDetails.matterId}
- Debtor: ${matterDetails.debtorName}
- Address: ${matterDetails.debtorAddress}
- Amount: R${matterDetails.outstandingBalance}
${matterDetails.dueDate ? `- Due Date: ${matterDetails.dueDate}` : ""}
${matterDetails.reference ? `- Reference: ${matterDetails.reference}` : ""}
${matterDetails.originalCreditor ? `- Original Creditor: ${matterDetails.originalCreditor}` : ""}

Generate ONLY the document body (no metadata). Use professional legal language appropriate for ${docType}.
Include all required legal clauses and threat of legal action where appropriate.`;

      const content =
        this.provider === "gemini"
          ? await this.callGemini(prompt)
          : await this.callDeepseek(prompt);

      const wordCount = content.split(/\s+/).length;
      const warnings: string[] = [];

      if (wordCount < 100)
        warnings.push("Document may be too short for legal validity");
      if (content.includes("DISCLAIMER"))
        warnings.push("Document includes disclaimer");

      return {
        content,
        wordCount,
        readabilityScore: Math.min(100, 60 + Math.random() * 30), // Mock score
        warnings,
      };
    } catch (error) {
      logger.warn(
        { error, docType, matterDetails },
        "AI document draft failed — falling back to mock template"
      );
      return this.mockDraftDocumentContent(docType, matterDetails);
    }
  }

  /**
   * FUNCTION 3: Recommend Stage Advancement
   * Analyzes matter data to recommend if it should advance to next stage
   *
   * Example:
   * Input: Matter in LOD for 15 days, no response, high interest accrual
   * Output: shouldAdvance=true, nextStage="S129", confidence=0.88
   */
  async recommendStageAdvancement(matterData: {
    matterId: string;
    currentStage: string;
    daysInStage: number;
    lastContactDaysAgo: number;
    responsiveness: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    outstandingBalance: number;
    interestAccrual: number;
    paymentHistory: string[];
    previousOffers: string[];
  }): Promise<StageAdvancementRecommendation> {
    try {
      if (this.provider === "mock") {
        return this.mockRecommendStageAdvancement(matterData);
      }

      const prompt = `Analyze this debt collection matter and recommend stage advancement:

Current Stage: ${matterData.currentStage}
Days in Stage: ${matterData.daysInStage}
Days Since Contact: ${matterData.lastContactDaysAgo}
Debtor Responsiveness: ${matterData.responsiveness}
Outstanding: R${matterData.outstandingBalance}
Interest Accrual: R${matterData.interestAccrual}/month
Payment History: ${matterData.paymentHistory.join(", ")}
Previous Offers: ${matterData.previousOffers.join(", ")}

Possible next stages: S129 (formal notice), SUMMONS (legal proceedings), JUDGMENT, WRIT, SALE

Respond ONLY in JSON format:
{
  "shouldAdvance": true|false,
  "nextStage": "S129|SUMMONS|JUDGMENT|WRIT|SALE|null",
  "confidence": 0.85,
  "reasoning": "Clear explanation of decision",
  "riskFactors": ["factor1", "factor2"],
  "timelineRecommendation": "Advance immediately or wait 5 days"
}`;

      const result =
        this.provider === "gemini"
          ? await this.callGemini(prompt)
          : await this.callDeepseek(prompt);

      const parsed = JSON.parse(result);
      return {
        shouldAdvance: parsed.shouldAdvance || false,
        nextStage: parsed.nextStage || null,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || "Unable to determine",
        riskFactors: parsed.riskFactors || [],
        timelineRecommendation:
          parsed.timelineRecommendation || "Review manually",
      };
    } catch (error) {
      logger.error(
        { error, matterId: matterData.matterId },
        "Failed to recommend stage advancement"
      );
      return {
        shouldAdvance: false,
        nextStage: null,
        confidence: 0,
        reasoning: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        riskFactors: ["Unable to analyze"],
        timelineRecommendation: "Please review manually",
      };
    }
  }

  /**
   * FUNCTION 4: Generate Payment Arrangement
   * Uses AI to negotiate realistic payment arrangements
   *
   * Example:
   * Input: Balance R10,000, debtor offers R500/month
   * Output: Proposes R600/month for 18 months, flags risk
   */
  async generatePaymentArrangement(negotiationContext: {
    matterId: string;
    outstandingBalance: number;
    monthlyInterest: number;
    debtorMonthlyIncome?: number;
    debtorOffer?: number;
    debtorProposedFrequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    previousArrangements?: string[];
    riskScore?: number; // 0-1
  }): Promise<PaymentArrangementResult> {
    try {
      if (this.provider === "mock") {
        return this.mockGeneratePaymentArrangement(negotiationContext);
      }

      const prompt = `Negotiate a realistic payment arrangement for debt collection:

Outstanding Balance: R${negotiationContext.outstandingBalance}
Monthly Interest: R${negotiationContext.monthlyInterest}
${negotiationContext.debtorMonthlyIncome ? `Debtor Monthly Income: R${negotiationContext.debtorMonthlyIncome}` : ""}
${negotiationContext.debtorOffer ? `Debtor Offered: R${negotiationContext.debtorOffer}/${negotiationContext.debtorProposedFrequency}` : ""}
${negotiationContext.riskScore ? `Risk Score: ${negotiationContext.riskScore}/1.0` : ""}
Previous Arrangements: ${negotiationContext.previousArrangements?.join(", ") || "None"}

Recommend:
- Amount per payment
- Frequency (WEEKLY, BIWEEKLY, MONTHLY)
- Duration in months
- Risk level (LOW, MEDIUM, HIGH)
- Negotiation tips

Respond ONLY in JSON format:
{
  "proposedAmount": 650,
  "proposedFrequency": "MONTHLY",
  "proposedDuration": 18,
  "totalPayable": 11700,
  "riskAssessment": "MEDIUM",
  "reasoning": "Realistic given income constraints",
  "negotiationTips": ["Allow weekly option if monthly fails", "Lock in writing immediately"]
}`;

      const result =
        this.provider === "gemini"
          ? await this.callGemini(prompt)
          : await this.callDeepseek(prompt);

      const parsed = JSON.parse(result);
      return {
        proposedAmount: parsed.proposedAmount || 500,
        proposedFrequency: parsed.proposedFrequency || "MONTHLY",
        proposedDuration: parsed.proposedDuration || 12,
        totalPayable:
          parsed.totalPayable ||
          (parsed.proposedAmount || 500) * (parsed.proposedDuration || 12),
        riskAssessment: parsed.riskAssessment || "MEDIUM",
        reasoning: parsed.reasoning || "See system analysis",
        negotiationTips: parsed.negotiationTips || [
          "Get agreement in writing",
        ],
      };
    } catch (error) {
      logger.warn(
        { error, matterId: negotiationContext.matterId },
        "AI payment arrangement failed — falling back to mock"
      );
      return this.mockGeneratePaymentArrangement(negotiationContext);
    }
  }

  // ========================================================================
  // PRIVATE API CALL METHODS
  // ========================================================================

  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Official modern Gemini usage (generateMessage) with a flexible auth strategy:
    // - If GEMINI_API_KEY looks like a Google API Key (starts with "AIza") we append ?key=...
    // - If an OAuth-style token is provided (e.g. starts with "ya29.") or GEMINI_ACCESS_TOKEN is set, we use Authorization: Bearer <token>
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    const useApiKeyQuery = this.geminiApiKey.startsWith("AIza");
    const oauthToken = process.env.GEMINI_ACCESS_TOKEN || (this.geminiApiKey.startsWith("ya29.") ? this.geminiApiKey : undefined);

    function extractTextFromResponse(data: any): string {
      if (!data) return "";
      // Typical message-style response
      if (data.candidates && data.candidates[0]) {
        const cand = data.candidates[0];
        if (cand.content) {
          if (Array.isArray(cand.content)) return cand.content.map((c: any) => c.text || c).join(" ");
          if (cand.content.parts) return cand.content.parts.map((p: any) => p.text || "").join(" ");
        }
      }

      // Newer message shape
      if (data.output && Array.isArray(data.output)) {
        const out = data.output.map((o: any) => {
          if (o.content) return o.content.map((c: any) => c.text || "").join(" ");
          return "";
        }).join(" ");
        if (out) return out;
      }

      if (data.choices && data.choices[0]) {
        const ch = data.choices[0];
        if (ch.message && ch.message.content) return ch.message.content;
        if (ch.text) return ch.text;
      }

      // Fallback: collect longest string in object
      const strings: string[] = [];
      (function walk(obj: any) {
        if (!obj) return;
        if (typeof obj === 'string') strings.push(obj);
        else if (Array.isArray(obj)) obj.forEach(walk);
        else if (typeof obj === 'object') Object.values(obj).forEach(walk);
      })(data);
      if (strings.length) return strings.sort((a, b) => b.length - a.length)[0];
      return "";
    }

    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    ];

    const bodyVariants: Array<{ name: string; body: any }> = [
      {
        name: "generateContent",
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
        },
      },
    ];

    let lastErr: any = null;
    for (const baseUrl of endpoints) {
      for (const variant of bodyVariants) {
        try {
          const url = useApiKeyQuery ? `${baseUrl}?key=${encodeURIComponent(this.geminiApiKey)}` : baseUrl;

          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (!useApiKeyQuery) {
            const token = oauthToken || this.geminiApiKey;
            headers["Authorization"] = `Bearer ${token}`;
          }

          logger.info({ url, variant: variant.name }, "Calling Gemini endpoint");
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(variant.body),
          });

          if (!response.ok) {
            const txt = await response.text().catch(() => "");
            lastErr = new Error(`Gemini API error: ${response.status} ${response.statusText} ${txt}`);
            continue;
          }

          const data = await response.json();
          const text = extractTextFromResponse(data);
          if (text && text.length > 0) return text;
          // No text found, try next variant
        } catch (err) {
          lastErr = err;
          continue;
        }
      }
    }

    throw lastErr || new Error("Gemini API: no valid response from tried endpoints and body variants");
  }

  private async callDeepseek(prompt: string): Promise<string> {
    if (!this.deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const response = await fetch(`${this.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  // ========================================================================
  // MOCK IMPLEMENTATIONS (for testing without API keys)
  // ========================================================================

  private mockClassifyDebtorIntent(
    message: string,
    _context?: Record<string, any>
  ): IntentClassificationResult {
    const messageLower = message.toLowerCase();
    let intent: DebtorIntent = "UNKNOWN";
    let confidence = 0.5;

    if (
      messageLower.includes("pay") ||
      messageLower.includes("afford") ||
      messageLower.includes("offer")
    ) {
      intent = "PAYMENT_OFFER";
      confidence = 0.85;
    } else if (
      messageLower.includes("discuss") ||
      messageLower.includes("negotiate") ||
      messageLower.includes("arrange")
    ) {
      intent = "NEGOTIATION_REQUEST";
      confidence = 0.8;
    } else if (
      messageLower.includes("dispute") ||
      messageLower.includes("wrong") ||
      messageLower.includes("not owed")
    ) {
      intent = "DISPUTE_CLAIM";
      confidence = 0.75;
    } else if (
      messageLower.includes("can't") ||
      messageLower.includes("cannot") ||
      messageLower.includes("no money")
    ) {
      intent = "INSUFFICIENT_FUNDS";
      confidence = 0.8;
    } else if (messageLower.includes("agreed") || messageLower.includes("ok")) {
      intent = "PAYMENT_AGREED";
      confidence = 0.9;
    } else if (
      messageLower.includes("stop") ||
      messageLower.includes("leave me") ||
      messageLower.includes("don't contact")
    ) {
      intent = "BLOCKED_CONTACT";
      confidence = 0.75;
    } else if (messageLower.includes("lawyer") || messageLower.includes("sue")) {
      intent = "LEGAL_THREAT";
      confidence = 0.7;
    }

    return {
      intent,
      confidence,
      reasoning: `Mock classification: ${intent}`,
      suggestedResponse: "Continue engagement based on intent",
    };
  }

  private mockDraftDocumentContent(
    docType: string,
    details: Record<string, any>
  ): DocumentDraftResult {
    const header = `${docType} NOTICE\n\nDate: ${new Date().toLocaleDateString()}\n\n`;
    const addressee = `To: ${details.debtorName}\n${details.debtorAddress}\n\n`;
    const body = `RE: Matter Reference ${details.matterId}
Outstanding Amount: R${details.outstandingBalance}

This serves as formal notice that amount is owing and due.

Should this amount not be settled within 10 days, legal proceedings will be instituted.

Your response is requested.`;

    const content = header + addressee + body;

    return {
      content,
      wordCount: content.split(/\s+/).length,
      readabilityScore: 75,
      warnings: [],
    };
  }

  private mockRecommendStageAdvancement(
    data: Record<string, any>
  ): StageAdvancementRecommendation {
    const shouldAdvance =
      data.daysInStage >= 10 && data.responsiveness !== "HIGH";
    const nextStageMap: Record<string, string> = {
      LOD: "S129",
      S129: "SUMMONS",
      SUMMONS: "JUDGMENT",
      JUDGMENT: "WRIT",
      WRIT: "SALE",
    };

    return {
      shouldAdvance,
      nextStage: shouldAdvance ? (nextStageMap[data.currentStage] || null) : null,
      confidence: 0.75,
      reasoning: `Mock recommendation based on ${data.daysInStage} days in stage`,
      riskFactors: ["No response", "Interest accruing"],
      timelineRecommendation: shouldAdvance ? "Advance immediately" : "Wait 5 days",
    };
  }

  private mockGeneratePaymentArrangement(
    context: Record<string, any>
  ): PaymentArrangementResult {
    const proposed = Math.ceil(context.outstandingBalance / 12);
    return {
      proposedAmount: proposed,
      proposedFrequency: "MONTHLY",
      proposedDuration: 12,
      totalPayable: proposed * 12,
      riskAssessment: "MEDIUM",
      reasoning: "Mock arrangement",
      negotiationTips: [
        "Get agreement in writing",
        "Consider weekly payments if monthly fails",
      ],
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const aiService = new AIService();
