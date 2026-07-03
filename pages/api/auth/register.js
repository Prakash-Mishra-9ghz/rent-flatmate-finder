const prisma = require("../../../lib/db");
const { hashPassword, signToken, setAuthCookie } = require("../../../lib/auth");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password, role are required" });
  }
  if (!["TENANT", "OWNER"].includes(role)) {
    return res.status(400).json({ error: "role must be TENANT or OWNER" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);

  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};
