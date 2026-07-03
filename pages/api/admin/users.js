const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ["ADMIN"]);
  if (!auth) return;

  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { listings: true, interestsSent: true } },
      },
    });
    return res.status(200).json({ users });
  }

  if (req.method === "PATCH") {
    const { userId, isActive } = req.body || {};
    if (!userId || typeof isActive !== "boolean") {
      return res.status(400).json({ error: "userId and isActive (boolean) are required" });
    }
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive } });
    return res.status(200).json({ user });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
