const prisma = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");
const { notifyTenantInterestResponse } = require("../../../../lib/email");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAuth(req, res, ["OWNER"]);
  if (!auth) return;

  const { id } = req.query;
  const { action } = req.body || {}; // "accept" | "decline"
  if (!["accept", "decline"].includes(action)) {
    return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
  }

  const interest = await prisma.interest.findUnique({
    where: { id },
    include: { listing: true, tenant: true },
  });
  if (!interest) return res.status(404).json({ error: "Interest not found" });
  if (interest.listing.ownerId !== auth.id) return res.status(403).json({ error: "Forbidden" });
  if (interest.status !== "PENDING") {
    return res.status(409).json({ error: "Interest already responded to" });
  }

  const status = action === "accept" ? "ACCEPTED" : "DECLINED";
  const updated = await prisma.interest.update({ where: { id }, data: { status } });

  await notifyTenantInterestResponse({
    tenantEmail: interest.tenant.email,
    tenantName: interest.tenant.name,
    listingLocation: interest.listing.location,
    accepted: status === "ACCEPTED",
  });

  return res.status(200).json({ interest: updated });
};
