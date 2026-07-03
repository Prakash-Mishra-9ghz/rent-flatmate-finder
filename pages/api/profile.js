const prisma = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ["TENANT"]);
  if (!auth) return;

  if (req.method === "GET") {
    const profile = await prisma.tenantProfile.findUnique({ where: { userId: auth.id } });
    return res.status(200).json({ profile });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const { preferredLocation, budgetMin, budgetMax, moveInDate, notes } = req.body || {};
    if (!preferredLocation || budgetMin == null || budgetMax == null || !moveInDate) {
      return res.status(400).json({
        error: "preferredLocation, budgetMin, budgetMax, moveInDate are required",
      });
    }
    if (Number(budgetMin) > Number(budgetMax)) {
      return res.status(400).json({ error: "budgetMin cannot exceed budgetMax" });
    }

    const profile = await prisma.tenantProfile.upsert({
      where: { userId: auth.id },
      update: {
        preferredLocation,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        moveInDate: new Date(moveInDate),
        notes: notes || null,
      },
      create: {
        userId: auth.id,
        preferredLocation,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        moveInDate: new Date(moveInDate),
        notes: notes || null,
      },
    });

    // Profile changed: invalidate previously cached compatibility scores so they
    // get recomputed (lazily, on next listing fetch) against the new preferences.
    await prisma.compatibility.deleteMany({ where: { tenantId: auth.id } });

    return res.status(200).json({ profile });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
