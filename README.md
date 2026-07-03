# 🏠 Rent & Flatmate Finder

A full-stack platform where room owners post listings and tenants find their best match via an **AI-powered compatibility engine**. Includes real-time chat, email notifications, and an admin dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (pages router) + custom Node.js server |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT in HTTP-only cookies |
| AI Scoring | Anthropic Claude or OpenAI GPT (configurable); rule-based fallback |
| Real-time Chat | Socket.IO (WebSocket) |
| Email | Nodemailer → any SMTP / Ethereal (auto-fallback in dev) |

---

## 🌐 Live Demo

https://rent-flatmate-finder-y26v.onrender.com

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted — [Supabase](https://supabase.com), [Railway](https://railway.app), [Neon](https://neon.tech) all have free tiers)

### 1. Clone & install

```bash
git clone <repo-url>
cd rent-flatmate-finder
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET` — any long random string
- `LLM_PROVIDER` — `"anthropic"`, `"openai"`, or `"none"`
- The matching API key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)

Email is **optional** — if you leave SMTP blank, the app auto-creates a free [Ethereal](https://ethereal.email) test account and logs preview URLs to the console.

### 3. Set up the database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# (Optional) Seed demo data
npm run seed
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo credentials after seeding:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@rff.local | admin123 |
| Owner | owner1@rff.local | owner123 |
| Owner | owner2@rff.local | owner123 |
| Tenant | tenant1@rff.local | tenant123 |
| Tenant | tenant2@rff.local | tenant123 |

---

## Production Deployment (Render / Railway)

1. Push code to GitHub.
2. Create a new Web Service → connect repo.
3. Set build command: `npm install && npm run prisma:generate && npx prisma migrate deploy`
4. Set start command: `npm start`
5. Add all environment variables from `.env.example`.
6. Add a PostgreSQL add-on (both Render and Railway provide this).

---

## Database Schema

```
User
  id, name, email, passwordHash, role (TENANT|OWNER|ADMIN), isActive

TenantProfile          — 1-to-1 with User (role=TENANT)
  preferredLocation, budgetMin, budgetMax, moveInDate, notes

Listing                — many-to-1 with User (role=OWNER)
  location, rent, availableFrom, roomType, furnishingStatus, photos[], description, isFilled

Compatibility          — unique per (tenantId, listingId)
  score (0-100), explanation, source (LLM | RULE_BASED_FALLBACK)
  ↳ Cached; recomputed only when tenant profile or listing core fields change

Interest               — many-to-many bridge: Tenant ↔ Listing
  status (PENDING | ACCEPTED | DECLINED), score (snapshot at time of interest)

Message                — many-to-1 with Interest
  senderId, body, createdAt
  ↳ Only exists when Interest.status = ACCEPTED
```

---

## API Reference

### Auth
| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{name, email, password, role}` | Register (role: TENANT or OWNER) |
| POST | `/api/auth/login` | `{email, password}` | Login; sets JWT cookie |
| POST | `/api/auth/logout` | — | Clears cookie |
| GET | `/api/auth/me` | — | Returns current user + tenantProfile |

### Tenant Profile
| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/profile` | — | Get my profile |
| POST | `/api/profile` | `{preferredLocation, budgetMin, budgetMax, moveInDate, notes?}` | Create / update profile; invalidates cached scores |

### Listings
| Method | Path | Body / Query | Description |
|---|---|---|---|
| GET | `/api/listings` | `?location=&budgetMin=&budgetMax=&mine=true` | Browse listings; tenants get AI scores ranked |
| POST | `/api/listings` | `{location, rent, availableFrom, roomType, furnishingStatus, photos?, description?}` | Owner creates listing |
| GET | `/api/listings/:id` | — | Single listing + compatibility score |
| PATCH | `/api/listings/:id` | Any listing fields | Owner updates listing |
| DELETE | `/api/listings/:id` | — | Owner or admin deletes listing |

### Interests
| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/interests` | — | List interests (role-filtered) |
| POST | `/api/interests` | `{listingId}` | Tenant expresses interest; triggers email if score > threshold |
| POST | `/api/interests/:id/respond` | `{action: "accept"\|"decline"}` | Owner responds; triggers email to tenant |

### Messages (REST — initial load)
| Method | Path | Description |
|---|---|---|
| GET | `/api/messages/:interestId` | Returns message history for accepted interest |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/activity` | Platform stats + recent interests |
| GET | `/api/admin/users` | All users with counts |
| PATCH | `/api/admin/users` | `{userId, isActive: bool}` — activate/deactivate |

### WebSocket (Socket.IO at `/api/socket`)

**Events sent by client:**

| Event | Payload | Ack response |
|---|---|---|
| `join_chat` | `{interestId}` | `{ok, history}` or `{error}` |
| `send_message` | `{interestId, body}` | `{ok, message}` or `{error}` |

**Events sent by server:**

| Event | Payload |
|---|---|
| `new_message` | Full message object with sender info |

---

## LLM Compatibility Scoring

### Prompt (exact)

```
Given this room listing: {"location":"...","rent":12000,"availableFrom":"...","roomType":"PRIVATE_ROOM","furnishingStatus":"FURNISHED","description":"..."} and this tenant profile: {"preferredLocation":"...","budgetMin":10000,"budgetMax":14000,"moveInDate":"...","notes":"..."}, compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { "score": number, "explanation": string }. Respond with ONLY the JSON object, no markdown fences, no extra commentary.
```

### Example Input / Output

**Input (listing):**
```json
{
  "location": "Koramangala, Bangalore",
  "rent": 12000,
  "availableFrom": "2025-08-01",
  "roomType": "PRIVATE_ROOM",
  "furnishingStatus": "FURNISHED",
  "description": "Bright private room, AC, WiFi. Ideal for working professionals."
}
```

**Input (tenant profile):**
```json
{
  "preferredLocation": "Koramangala, Bangalore",
  "budgetMin": 10000,
  "budgetMax": 14000,
  "moveInDate": "2025-08-01",
  "notes": "Non-smoker, working professional"
}
```

**LLM Response:**
```json
{
  "score": 92,
  "explanation": "Excellent match. The listing is in exactly the preferred location (Koramangala, Bangalore) and the rent of ₹12,000 falls comfortably within the tenant's budget range of ₹10,000–14,000. The furnished private room with AC and WiFi suits a working professional well. Move-in dates also align."
}
```

### Rule-based Fallback (when LLM unavailable)

- **Budget (60%):** 100 if rent within range; decays proportionally outside.
- **Location (40%):** 100 exact match, 75 substring, 50 token overlap, 10 no match.
- `source` field set to `"RULE_BASED_FALLBACK"` and shown in the UI.

---

## Project Structure

```
rent-flatmate-finder/
├── lib/
│   ├── auth.js          # JWT, cookie helpers, requireAuth()
│   ├── db.js            # Prisma singleton
│   ├── email.js         # Nodemailer + notification helpers
│   ├── llm.js           # AI compatibility engine + fallback
│   └── useUser.js       # React auth context
├── pages/
│   ├── api/             # All REST API routes
│   │   ├── auth/        # register, login, logout, me
│   │   ├── listings/    # CRUD + AI-scored browse
│   │   ├── interests/   # create, list, respond
│   │   ├── messages/    # history REST endpoint
│   │   ├── admin/       # activity, users
│   │   └── profile.js
│   ├── listings/        # Browse + detail pages (tenant)
│   ├── owner/listings/  # Owner dashboard + create/edit
│   ├── chat/            # Real-time chat page
│   ├── admin.js         # Admin dashboard
│   ├── interests.js     # Interests list (tenant & owner)
│   ├── profile.js       # Tenant profile setup
│   ├── register.js
│   └── login.js
├── components/
│   ├── Navbar.js
│   └── ScoreBadge.js
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── styles/globals.css
├── server.js            # Custom server: Next.js + Socket.IO
├── next.config.js
├── .env.example
├── SYSTEM_DESIGN.md
└── README.md
```
