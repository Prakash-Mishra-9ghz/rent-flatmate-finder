const prisma = require("../../../lib/db");
const { comparePassword, signToken, setAuthCookie } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);

  return res.status(200).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};
