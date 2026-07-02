/**
 * Seed script — run once after migrations:
 *   node prisma/seed.js
 *
 * Creates:
 *  • 1 admin
 *  • 2 owners with 3 listings each
 *  • 2 tenants with profiles
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const hash = (p) => bcrypt.hash(p, 10);

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@rff.local" },
    update: {},
    create: { name: "Admin", email: "admin@rff.local", passwordHash: await hash("admin123"), role: "ADMIN" },
  });

  // Owners
  const owner1 = await prisma.user.upsert({
    where: { email: "owner1@rff.local" },
    update: {},
    create: { name: "Ravi Kumar", email: "owner1@rff.local", passwordHash: await hash("owner123"), role: "OWNER" },
  });
  const owner2 = await prisma.user.upsert({
    where: { email: "owner2@rff.local" },
    update: {},
    create: { name: "Priya Sharma", email: "owner2@rff.local", passwordHash: await hash("owner123"), role: "OWNER" },
  });

  // Listings
  const listings = [
    { ownerId: owner1.id, location: "Koramangala, Bangalore", rent: 12000, availableFrom: new Date("2025-08-01"), roomType: "PRIVATE_ROOM", furnishingStatus: "FURNISHED", description: "Bright private room in a 3BHK flat. AC, WiFi included. Ideal for working professionals." },
    { ownerId: owner1.id, location: "Indiranagar, Bangalore", rent: 15000, availableFrom: new Date("2025-08-15"), roomType: "ENTIRE_FLAT", furnishingStatus: "SEMI_FURNISHED", description: "1BHK apartment available for single occupancy. Walking distance to metro." },
    { ownerId: owner1.id, location: "HSR Layout, Bangalore", rent: 9000, availableFrom: new Date("2025-09-01"), roomType: "SHARED_ROOM", furnishingStatus: "FURNISHED", description: "Shared room in a clean, quiet 4BHK. Separate bathrooms. Vegetarians preferred." },
    { ownerId: owner2.id, location: "Bandra, Mumbai", rent: 22000, availableFrom: new Date("2025-08-01"), roomType: "PRIVATE_ROOM", furnishingStatus: "FURNISHED", description: "Spacious room in sea-facing flat. 2 flatmates, professionals only." },
    { ownerId: owner2.id, location: "Powai, Mumbai", rent: 18000, availableFrom: new Date("2025-07-20"), roomType: "PRIVATE_ROOM", furnishingStatus: "SEMI_FURNISHED", description: "Modern building near Hiranandani. Gym & pool access included." },
    { ownerId: owner2.id, location: "Andheri West, Mumbai", rent: 14000, availableFrom: new Date("2025-09-01"), roomType: "SHARED_ROOM", furnishingStatus: "UNFURNISHED", description: "Affordable shared room near metro. Perfect for students or recent graduates." },
  ];

  for (const l of listings) {
    const existing = await prisma.listing.findFirst({ where: { ownerId: l.ownerId, location: l.location } });
    if (!existing) await prisma.listing.create({ data: l });
  }

  // Tenants
  const tenant1 = await prisma.user.upsert({
    where: { email: "tenant1@rff.local" },
    update: {},
    create: { name: "Arjun Mehta", email: "tenant1@rff.local", passwordHash: await hash("tenant123"), role: "TENANT" },
  });
  const tenant2 = await prisma.user.upsert({
    where: { email: "tenant2@rff.local" },
    update: {},
    create: { name: "Sneha Reddy", email: "tenant2@rff.local", passwordHash: await hash("tenant123"), role: "TENANT" },
  });

  await prisma.tenantProfile.upsert({
    where: { userId: tenant1.id },
    update: {},
    create: { userId: tenant1.id, preferredLocation: "Koramangala, Bangalore", budgetMin: 10000, budgetMax: 14000, moveInDate: new Date("2025-08-01"), notes: "Non-smoker, working professional, veg preferred" },
  });
  await prisma.tenantProfile.upsert({
    where: { userId: tenant2.id },
    update: {},
    create: { userId: tenant2.id, preferredLocation: "Bandra, Mumbai", budgetMin: 18000, budgetMax: 25000, moveInDate: new Date("2025-08-15"), notes: "Female, remote worker, looking for peaceful environment" },
  });

  console.log("✅ Seed complete.");
  console.log("   admin@rff.local       / admin123");
  console.log("   owner1@rff.local      / owner123");
  console.log("   owner2@rff.local      / owner123");
  console.log("   tenant1@rff.local     / tenant123");
  console.log("   tenant2@rff.local     / tenant123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
