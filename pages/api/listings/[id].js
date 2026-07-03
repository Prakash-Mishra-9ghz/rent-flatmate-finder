const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { computeCompatibility } = require("../../../lib/llm");

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") return getListing(req, res, id);
  if (req.method === "PATCH") return updateListing(req, res, id);
  if (req.method === "DELETE") return deleteListing(req, res, id);
  return res.status(405).json({ error: "Method not allowed" });
};

async function getListing(req, res, id) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  let compatibility = null;
  if (auth.role === "TENANT") {
    const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId: auth.id } });
    if (tenantProfile) {
      let compat = await prisma.compatibility.findUnique({
        where: { tenantId_listingId: { tenantId: auth.id, listingId: listing.id } },
      });
      if (!compat) {
        const result = await computeCompatibility(listing, tenantProfile);
        compat = await prisma.compatibility.create({
          data: {
            tenantId: auth.id,
            listingId: listing.id,
            score: result.score,
            explanation: result.explanation,
            source: result.source,
          },
        });
      }
      compatibility = compat;
    }
  }

  return res.status(200).json({ listing, compatibility });
}

async function updateListing(req, res, id) {
  const auth = requireAuth(req, res, ["OWNER"]);
  if (!auth) return;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.ownerId !== auth.id) return res.status(403).json({ error: "Forbidden" });

  const allowed = [
    "location",
    "rent",
    "availableFrom",
    "roomType",
    "furnishingStatus",
    "photos",
    "description",
    "isFilled",
  ];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (data.rent !== undefined) data.rent = Number(data.rent);
  if (data.availableFrom !== undefined) data.availableFrom = new Date(data.availableFrom);

  const updated = await prisma.listing.update({ where: { id }, data });

  // If core attributes changed, invalidate cached compatibility scores tied to this listing.
  if (["location", "rent", "roomType", "furnishingStatus"].some((k) => data[k] !== undefined)) {
    await prisma.compatibility.deleteMany({ where: { listingId: id } });
  }

  return res.status(200).json({ listing: updated });
}

async function deleteListing(req, res, id) {
  const auth = requireAuth(req, res, ["OWNER", "ADMIN"]);
  if (!auth) return;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (auth.role !== "ADMIN" && listing.ownerId !== auth.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.listing.delete({ where: { id } });
  return res.status(200).json({ ok: true });
}
