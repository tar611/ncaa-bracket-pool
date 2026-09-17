import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const brackets = await prisma.bracket.findMany({
    include: { user: { select: { displayName: true } } },
    orderBy: { totalScore: "desc" },
  });

  res.json(
    brackets.map((bracket) => ({
      bracketId: bracket.id,
      bracketName: bracket.name,
      displayName: bracket.user.displayName,
      totalScore: bracket.totalScore,
    })),
  );
});

export default router;
