import { Router } from "express";

const router = Router();

// Public contact endpoint — accepts name/email/message and returns success.
// This endpoint is intentionally unauthenticated so marketing CTAs can submit.
router.post("/contact", async (req, res): Promise<void> => {
  try {
    const { name, email, message } = req.body ?? {};
    if (!email || !message) {
      res.status(400).json({ error: "Missing email or message" });
      return;
    }

    // For now, just log the request and respond. This keeps the API public
    // without requiring a DB schema change. Integrate with an email service
    // or a persisted 'contact_requests' table later when desired.
    // eslint-disable-next-line no-console
    console.info("Public contact request:", { name, email, message });

    res.status(201).json({ success: true, message: "Contact request received" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to process contact request", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
