import { Router } from "express";
import { hashPassword, signToken, verifyPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";

const router = Router();

router.post("/signup", async (req, res) => {
  const { email, password, displayName } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || typeof displayName !== "string") {
    res.status(400).json({ error: "email, password, and displayName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  const token = signToken({ userId: user.id });
  res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    // Same message for "no such user" and "wrong password" — anything more
    // specific tells an attacker which emails are registered.
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
});

export default router;
