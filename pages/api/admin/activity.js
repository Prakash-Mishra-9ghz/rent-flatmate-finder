const prisma = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const auth = requireAuth(req, res, ["ADMIN"]);
  if (!auth) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const [userCount, listingCount, filledCount, interestCount, acceptedCount, messageCount, recentInterests] =
    await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.listing.count({ where: { isFilled: true } }),
      prisma.interest.count(),
      prisma.interest.count({ where: { status: "ACCEPTED" } }),
      prisma.message.count(),
      prisma.interest.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          tenant: { select: { name: true, email: true } },
          listing: { select: { location: true, rent: true } },
        },
      }),
    ]);

  return res.status(200).json({
    stats: {
      userCount,
      listingCount,
      filledCount,
      interestCount,
      acceptedCount,
      messageCount,
    },
    recentInterests,
  });
};
