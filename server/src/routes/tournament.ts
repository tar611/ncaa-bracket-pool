import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { getTournamentLockAt, isTournamentLocked } from "../lib/tournamentConfig";

const router = Router();

router.get("/slots", requireAuth, async (_req, res) => {
  const slots = await prisma.bracketSlot.findMany({
    include: { team1: true, team2: true, winnerTeam: true },
    orderBy: [{ round: "asc" }, { region: "asc" }, { slotIndex: "asc" }],
  });

  res.json({
    lockAt: getTournamentLockAt().toISOString(),
    locked: isTournamentLocked(),
    slots,
  });
});

export default router;
