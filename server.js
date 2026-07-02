const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const prisma = require("./lib/db");
const { verifyToken, COOKIE_NAME } = require("./lib/auth");
const cookie = require("cookie");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socket",
  });

  // Authenticate every socket connection using the same JWT cookie as the REST API.
  io.use((socket, next2) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) return next2(new Error("Not authenticated"));
      const parsed = cookie.parse(rawCookie);
      const token = parsed[COOKIE_NAME];
      const payload = token ? verifyToken(token) : null;
      if (!payload) return next2(new Error("Not authenticated"));
      socket.user = payload; // { id, email, role }
      next2();
    } catch (err) {
      next2(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_chat", async ({ interestId }, ack) => {
      try {
        const interest = await prisma.interest.findUnique({
          where: { id: interestId },
          include: { listing: true },
        });
        if (!interest || interest.status !== "ACCEPTED") {
          return ack && ack({ error: "Chat not available for this interest" });
        }
        const isTenant = interest.tenantId === socket.user.id;
        const isOwner = interest.listing.ownerId === socket.user.id;
        if (!isTenant && !isOwner) {
          return ack && ack({ error: "Forbidden" });
        }
        socket.join(`interest:${interestId}`);
        const history = await prisma.message.findMany({
          where: { interestId },
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true, role: true } } },
        });
        ack && ack({ ok: true, history });
      } catch (err) {
        console.error("[socket] join_chat error:", err);
        ack && ack({ error: "Server error" });
      }
    });

    socket.on("send_message", async ({ interestId, body }, ack) => {
      try {
        if (!body || !body.trim()) return ack && ack({ error: "Message body required" });
        const interest = await prisma.interest.findUnique({
          where: { id: interestId },
          include: { listing: true },
        });
        if (!interest || interest.status !== "ACCEPTED") {
          return ack && ack({ error: "Chat not available for this interest" });
        }
        const isTenant = interest.tenantId === socket.user.id;
        const isOwner = interest.listing.ownerId === socket.user.id;
        if (!isTenant && !isOwner) {
          return ack && ack({ error: "Forbidden" });
        }

        const message = await prisma.message.create({
          data: {
            interestId,
            senderId: socket.user.id,
            body: body.trim().slice(0, 5000),
          },
          include: { sender: { select: { id: true, name: true, role: true } } },
        });

        io.to(`interest:${interestId}`).emit("new_message", message);
        ack && ack({ ok: true, message });
      } catch (err) {
        console.error("[socket] send_message error:", err);
        ack && ack({ error: "Server error" });
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
