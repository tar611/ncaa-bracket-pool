import { Router } from "express";
import { syncScoresForDate } from "../lib/espnSync";

const router = Router();

// Triggered by a scheduled job (see .github/workflows/sync-scores.yml), not
// by a logged-in user — protected by a shared secret instead of requireAuth
// since there's no user session in a cron context.
router.post("/sync-scores", async (req, res) => {
  const secret = req.headers["x-sync-secret"];
  if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
    res.status(401).json({ error: "Invalid or missing sync secret" });
    return;
  }

  try {
    const summary = await syncScoresForDate();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
