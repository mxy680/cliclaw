import { Router, type Request, type Response } from "express";
import { stmts, generateId } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = Router();

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

// GET /admin/users — list all users
router.get("/users", (_req: Request, res: Response) => {
  const users = stmts.listUsers.all();
  res.json({ users });
});

// GET /admin/access — list all access entries
router.get("/access", (_req: Request, res: Response) => {
  const access = stmts.listAllAccess.all();
  res.json({ access });
});

// POST /admin/access — grant access
router.post("/access", (req: Request, res: Response) => {
  const { email, agentName } = req.body as { email?: string; agentName?: string };

  if (!email || !agentName) {
    res.status(400).json({ error: "email and agentName required" });
    return;
  }

  // Find or create user
  let user = stmts.findUserByEmail.get(email.toLowerCase().trim()) as { id: string } | undefined;
  if (!user) {
    const id = generateId();
    user = stmts.createUser.get(id, email.toLowerCase().trim()) as { id: string };
  }

  const id = generateId();
  stmts.grantAccess.run(id, user.id, agentName, req.user!.email);

  res.json({ ok: true });
});

// DELETE /admin/access — revoke access
router.delete("/access", (req: Request, res: Response) => {
  const { userId, agentName } = req.body as { userId?: string; agentName?: string };

  if (!userId || !agentName) {
    res.status(400).json({ error: "userId and agentName required" });
    return;
  }

  stmts.revokeAccess.run(userId, agentName);
  res.json({ ok: true });
});

export default router;
