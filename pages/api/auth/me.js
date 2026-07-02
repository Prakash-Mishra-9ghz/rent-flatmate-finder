const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = requireAuth(req, res);
  if (!auth) return;

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    include: { tenantProfile: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantProfile: user.tenantProfile,
    },
  });
};
