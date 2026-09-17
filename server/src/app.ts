import cors from "cors";
import express from "express";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import bracketRoutes from "./routes/brackets";
import leaderboardRoutes from "./routes/leaderboard";
import tournamentRoutes from "./routes/tournament";
import { prisma } from "./lib/prisma";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/brackets", bracketRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/tournament", tournamentRoutes);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});
