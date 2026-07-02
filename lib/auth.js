const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookie = require("cookie");

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const COOKIE_NAME = "rff_token";
const TOKEN_TTL = "7d";

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function setAuthCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    })
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  );
}

function getTokenFromReq(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parse(header);
  return parsed[COOKIE_NAME] || null;
}

// Use in API routes: const user = requireAuth(req, res); if (!user) return;
function requireAuth(req, res, roles) {
  const token = getTokenFromReq(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  if (roles && roles.length && !roles.includes(payload.role)) {
    res.status(403).json({ error: "Forbidden: insufficient role" });
    return null;
  }
  return payload; // { id, email, role }
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromReq,
  requireAuth,
  COOKIE_NAME,
};
