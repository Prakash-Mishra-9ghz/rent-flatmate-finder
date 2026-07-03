const prisma = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { computeCompatibility } = require("../../../lib/llm");

export default async function handler(req, res) {
  if (req.method === "POST") return createListing(req, res);
  if (req.method === "GET") return listListings(req, res);
  return res.status(405).json({ error: "Method not allowed" });
};

async function createListing(req, res) {
  const auth = requireAuth(req, res, ["OWNER"]);
  if (!auth) return;

  const {
    location,
    rent,
    availableFrom,
    roomType,
    furnishingStatus,
    photos,
    description,
  } = req.body || {};

  if (!location || !rent || !availableFrom || !roomType || !furnishingStatus) {
    return res.status(400).json({
      error: "location, rent, availableFrom, roomType, furnishingStatus are required",
    });
  }

  const listing = await prisma.listing.create({
    data: {
      ownerId: auth.id,
      location,
      rent: Number(rent),
      availableFrom: new Date(availableFrom),
      roomType,
      furnishingStatus,
      photos: Array.isArray(photos) ? photos : [],
      description: description || null,
    },
  });

  return res.status(201).json({ listing });
}

async function listListings(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { location, budgetMin, budgetMax, mine } = req.query;

  // Owners viewing "my listings"
  if (auth.role === "OWNER" && mine === "true") {
    const listings = await prisma.listing.findMany({
      where: { ownerId: auth.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { interests: true } } },
    });
    return res.status(200).json({ listings });
  }

  const where = { isFilled: false };
  if (location) where.location = { contains: String(location), mode: "insensitive" };
  if (budgetMin || budgetMax) {
    where.rent = {};
    if (budgetMin) where.rent.gte = Number(budgetMin);
    if (budgetMax) where.rent.lte = Number(budgetMax);
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { id: true, name: true } } },
  });

  // Only tenants get AI-ranked compatibility scores; others see plain listings.
  if (auth.role !== "TENANT") {
    return res.status(200).json({ listings });
  }

  const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId: auth.id } });
  if (!tenantProfile) {
    return res.status(200).json({
      listings: listings.map((l) => ({ ...l, compatibility: null })),
      warning: "Create a tenant profile to see AI compatibility scores.",
    });
  }

  const enriched = await Promise.all(
    listings.map(async (listing) => {
      let compat = await prisma.compatibility.findUnique({
        where: { tenantId_listingId: { tenantId: auth.id, listingId: listing.id } },
      });

      // Compute once, then cache. Never recomputed on every request.
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

      return {
        ...listing,
        compatibility: {
          score: compat.score,
          explanation: compat.explanation,
          source: compat.source,
        },
      };
    })
  );

  enriched.sort((a, b) => (b.compatibility?.score || 0) - (a.compatibility?.score || 0));

  return res.status(200).json({ listings: enriched });
}
