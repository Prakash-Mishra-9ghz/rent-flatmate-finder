# System Design Write-up — Rent & Flatmate Finder

## 1. Compatibility Scoring Design

The compatibility engine solves a core matchmaking problem: given a tenant's preferences (location, budget, move-in date, notes) and a listing's attributes (location, rent, room type, furnishing, description), how well do they align?

### Score computation
A single LLM prompt bundles both objects as JSON and asks the model to return `{ score: number, explanation: string }`. The score range is 0–100. Weights are intentionally left to the LLM rather than hard-coded, because natural language context (e.g. "vegetarian preferred" matching "veg household") is difficult to capture with deterministic rules alone.

### Caching — one computation per tenant-listing pair
Scores are stored in a `Compatibility` table keyed on `(tenantId, listingId)`. On subsequent listing fetches the cached row is returned immediately — no LLM call is made. Cache invalidation is triggered only on two events:
- The tenant updates their profile (all their cached scores are deleted).
- The owner edits core listing attributes — location, rent, room type, furnishing (scores for that listing are deleted).

This keeps the UI fast, API costs low, and scores fresh without a background job.

---

## 2. LLM Integration and Fallback

### Provider abstraction
`lib/llm.js` exposes a single `computeCompatibility(listing, tenantProfile)` function. The concrete provider — Anthropic Claude or OpenAI — is selected at runtime via the `LLM_PROVIDER` environment variable. Both providers receive an identical prompt and their responses are parsed through the same `extractJson()` helper that strips markdown fences before parsing.

### Graceful fallback
Every LLM call is wrapped in a `Promise.race` with a 12-second timeout. Any failure — missing API key, network error, HTTP 429, malformed JSON, or timeout — is caught and falls through to `ruleBasedScore()`. The rule-based scorer weighs:
- **Budget match (60%):** full score if rent is inside `[budgetMin, budgetMax]`; decays proportionally outside.
- **Location match (40%):** exact string match → 100, substring match → 75, token overlap → 50, no match → 10.

The `source` field on each `Compatibility` row records `"LLM"` or `"RULE_BASED_FALLBACK"`, surfaced in the UI so tenants know which scoring method was used.

Setting `LLM_PROVIDER=none` opts out of LLM calls entirely, making the platform fully functional without any AI API key — useful for local development and CI.

---

## 3. Chat Implementation

### Transport
Real-time messaging uses **Socket.IO** mounted on a custom Node.js HTTP server (`server.js`) alongside Next.js. Socket.IO was chosen over raw WebSockets for its automatic reconnection, rooms abstraction, and reliable acknowledgement callbacks (`ack` pattern used on every emit).

### Authentication
Every socket connection is authenticated in the `io.use()` middleware layer: it reads the same `rff_token` HTTP-only cookie used by the REST API, verifies the JWT, and attaches the decoded payload to `socket.user`. Unauthenticated connections are rejected before any room is joined.

### Room isolation
Each accepted interest maps to a Socket.IO room named `interest:<id>`. `join_chat` validates that:
1. The interest exists and is `ACCEPTED`.
2. The requesting socket is either the tenant or the listing's owner.

Messages emitted to the room are only delivered to those two parties.

### Persistence
Every `send_message` event creates a `Message` row in PostgreSQL before broadcasting. On `join_chat` the server returns the full message history, so a page reload or late join receives all prior context without a separate REST call.

---

## 4. Notification Flow

Email notifications use **Nodemailer**. In production, an SMTP server is configured via environment variables (`SMTP_HOST`, `SMTP_PORT`, etc.). In development, when no SMTP config is present, the app creates a free **Ethereal** test account on first use and logs a preview URL to the console — no external account required.

### Two notification triggers

**Owner notification — high-compatibility interest:**
When a tenant expresses interest and the computed compatibility score exceeds the `HIGH_COMPATIBILITY_THRESHOLD` (default 80), an email is sent to the owner immediately after the `Interest` row is created. The email includes the tenant's name, listing location, score, and the AI explanation paragraph. This surfaces the highest-quality leads without spamming owners with every request.

**Tenant notification — owner response:**
When an owner accepts or declines an interest (via `POST /api/interests/:id/respond`), an email is dispatched to the tenant. Accepted emails include a prompt to log in and start chatting; declined emails omit a reason to preserve owner privacy.

Email failures are caught and logged but never propagate to the HTTP response — a failed email must not fail an interest acceptance.

---

## Architecture Summary

```
Browser ──REST──▶ Next.js API Routes ──▶ PostgreSQL (via Prisma)
       ◀─────────                    ◀──
       ──WS────▶  Socket.IO (server.js)
                       │
                  LLM API (Anthropic / OpenAI)
                  Nodemailer → SMTP
```

The single-server architecture (Next.js + Socket.IO co-located) keeps deployment straightforward — one Dockerfile or one Railway/Render service. For horizontal scaling, Socket.IO's Redis adapter can be added with a single line change; the Prisma `Compatibility` cache ensures LLM cost does not grow with replica count.
