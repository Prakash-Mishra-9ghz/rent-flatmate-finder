const prisma = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { interestId } = req.query;
  const interest = await prisma.interest.findUnique({
    where: { id: interestId },
    include: { listing: true },
  });
  if (!interest) return res.status(404).json({ error: "Interest not found" });

  const isTenant = interest.tenantId === auth.id;
  const isOwner = interest.listing.ownerId === auth.id;
  if (!isTenant && !isOwner && auth.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (interest.status !== "ACCEPTED") {
    return res.status(409).json({ error: "Chat is only available once interest is accepted" });
  }

  const messages = await prisma.message.findMany({
    where: { interestId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return res.status(200).json({ messages, interest });
};
