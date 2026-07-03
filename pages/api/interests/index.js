const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { computeCompatibility } = require("../../../lib/llm");
const { notifyOwnerHighCompatibilityInterest } = require("../../../lib/email");

const HIGH_COMPATIBILITY_THRESHOLD = Number(process.env.HIGH_COMPATIBILITY_THRESHOLD || 80);

export default async function handler(req, res) {
  if (req.method === "POST") return createInterest(req, res);
  if (req.method === "GET") return listInterests(req, res);
  return res.status(405).json({ error: "Method not allowed" });
};

async function createInterest(req, res) {
  const auth = requireAuth(req, res, ["TENANT"]);
  if (!auth) return;

  const { listingId } = req.body || {};
  if (!listingId) return res.status(400).json({ error: "listingId is required" });

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { owner: true },
  });
  if (!listing || listing.isFilled) {
    return res.status(404).json({ error: "Listing not found or already filled" });
  }

  const existing = await prisma.interest.findUnique({
    where: { tenantId_listingId: { tenantId: auth.id, listingId } },
  });
  if (existing) return res.status(409).json({ error: "Interest already expressed for this listing" });

  const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId: auth.id } });
  if (!tenantProfile) {
    return res.status(400).json({ error: "Create your tenant profile before expressing interest" });
  }

  let compat = await prisma.compatibility.findUnique({
    where: { tenantId_listingId: { tenantId: auth.id, listingId } },
  });
  if (!compat) {
    const result = await computeCompatibility(listing, tenantProfile);
    compat = await prisma.compatibility.create({
      data: {
        tenantId: auth.id,
        listingId,
        score: result.score,
        explanation: result.explanation,
        source: result.source,
      },
    });
  }

  const interest = await prisma.interest.create({
    data: {
      tenantId: auth.id,
      listingId,
      score: compat.score,
    },
  });

  if (compat.score > HIGH_COMPATIBILITY_THRESHOLD) {
    const tenant = await prisma.user.findUnique({ where: { id: auth.id } });
    await notifyOwnerHighCompatibilityInterest({
      ownerEmail: listing.owner.email,
      ownerName: listing.owner.name,
      tenantName: tenant.name,
      listingLocation: listing.location,
      score: compat.score,
      explanation: compat.explanation,
    });
  }

  return res.status(201).json({ interest, compatibility: compat });
}

async function listInterests(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (auth.role === "TENANT") {
    const interests = await prisma.interest.findMany({
      where: { tenantId: auth.id },
      orderBy: { createdAt: "desc" },
      include: { listing: { include: { owner: { select: { id: true, name: true } } } } },
    });
    return res.status(200).json({ interests });
  }

  if (auth.role === "OWNER") {
    const interests = await prisma.interest.findMany({
      where: { listing: { ownerId: auth.id } },
      orderBy: { createdAt: "desc" },
      include: {
        listing: true,
        tenant: { select: { id: true, name: true, email: true } },
      },
    });
    return res.status(200).json({ interests });
  }

  // Admin: all interests
  const interests = await prisma.interest.findMany({
    orderBy: { createdAt: "desc" },
    include: { listing: true, tenant: { select: { id: true, name: true, email: true } } },
  });
  return res.status(200).json({ interests });
}
