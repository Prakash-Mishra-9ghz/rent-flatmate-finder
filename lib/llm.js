/**
 * AI Compatibility Engine
 * ------------------------
 * Computes a 0-100 compatibility score + explanation for a (tenant profile, listing) pair.
 *
 * Provider is selected via env LLM_PROVIDER = "anthropic" | "openai" | "none".
 * If the LLM call fails for ANY reason (no API key, network error, timeout,
 * malformed response, rate limit) we fall back to a deterministic rule-based
 * score so the feature never breaks the user flow.
 *
 * The result (score, explanation, source) is meant to be cached by the caller
 * in the Compatibility table - this module does not do any DB access itself.
 */

const LLM_PROVIDER = (process.env.LLM_PROVIDER || "none").toLowerCase();
const LLM_TIMEOUT_MS = 12000;

function buildPrompt(listing, tenantProfile) {
  return `Given this room listing: ${JSON.stringify({
    location: listing.location,
    rent: listing.rent,
    availableFrom: listing.availableFrom,
    roomType: listing.roomType,
    furnishingStatus: listing.furnishingStatus,
    description: listing.description || "",
  })} and this tenant profile: ${JSON.stringify({
    preferredLocation: tenantProfile.preferredLocation,
    budgetMin: tenantProfile.budgetMin,
    budgetMax: tenantProfile.budgetMax,
    moveInDate: tenantProfile.moveInDate,
    notes: tenantProfile.notes || "",
  })}, compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { "score": number, "explanation": string }. Respond with ONLY the JSON object, no markdown fences, no extra commentary.`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("LLM request timed out")), ms)),
  ]);
}

function extractJson(text) {
  if (!text) throw new Error("Empty LLM response");
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : cleaned;
  const parsed = JSON.parse(jsonStr);
  if (typeof parsed.score !== "number" || typeof parsed.explanation !== "string") {
    throw new Error("LLM response missing required fields");
  }
  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  return { score, explanation: parsed.explanation.trim() };
}

async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const resp = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    }),
    LLM_TIMEOUT_MS
  );
  if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status}`);
  const data = await resp.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  return extractJson(text);
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const resp = await withTimeout(
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
      }),
    }),
    LLM_TIMEOUT_MS
  );
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  return extractJson(text);
}

/**
 * Deterministic rule-based fallback.
 * Weighs budget overlap (60%) and location match (40%).
 */
function ruleBasedScore(listing, tenantProfile) {
  let budgetScore = 0;
  const { rent } = listing;
  const { budgetMin, budgetMax } = tenantProfile;

  if (rent >= budgetMin && rent <= budgetMax) {
    budgetScore = 100;
  } else if (rent < budgetMin) {
    const diff = budgetMin - rent;
    budgetScore = Math.max(0, 100 - (diff / Math.max(budgetMin, 1)) * 100);
  } else {
    const diff = rent - budgetMax;
    budgetScore = Math.max(0, 100 - (diff / Math.max(budgetMax, 1)) * 150);
  }

  const normalize = (s) => (s || "").toLowerCase().trim();
  const tenantLoc = normalize(tenantProfile.preferredLocation);
  const listingLoc = normalize(listing.location);
  let locationScore = 0;
  if (tenantLoc && listingLoc) {
    if (tenantLoc === listingLoc) {
      locationScore = 100;
    } else if (listingLoc.includes(tenantLoc) || tenantLoc.includes(listingLoc)) {
      locationScore = 75;
    } else {
      const tenantTokens = new Set(tenantLoc.split(/[\s,]+/).filter(Boolean));
      const listingTokens = new Set(listingLoc.split(/[\s,]+/).filter(Boolean));
      const overlap = [...tenantTokens].filter((t) => listingTokens.has(t));
      locationScore = overlap.length > 0 ? 50 : 10;
    }
  }

  const finalScore = Math.round(budgetScore * 0.6 + locationScore * 0.4);

  const budgetNote =
    rent >= budgetMin && rent <= budgetMax
      ? `Rent of ${rent} fits within the tenant's budget range (${budgetMin}-${budgetMax}).`
      : `Rent of ${rent} is outside the tenant's budget range (${budgetMin}-${budgetMax}).`;
  const locationNote =
    locationScore >= 75
      ? `Listing location "${listing.location}" closely matches preferred location "${tenantProfile.preferredLocation}".`
      : locationScore >= 50
      ? `Listing location "${listing.location}" partially overlaps with preferred location "${tenantProfile.preferredLocation}".`
      : `Listing location "${listing.location}" does not match preferred location "${tenantProfile.preferredLocation}".`;

  return {
    score: finalScore,
    explanation: `${budgetNote} ${locationNote} (rule-based estimate, AI scoring unavailable).`,
  };
}

/**
 * Main entry point. Always resolves - never throws.
 * Returns { score, explanation, source }.
 */
async function computeCompatibility(listing, tenantProfile) {
  if (LLM_PROVIDER === "none") {
    return { ...ruleBasedScore(listing, tenantProfile), source: "RULE_BASED_FALLBACK" };
  }

  const prompt = buildPrompt(listing, tenantProfile);
  try {
    const result =
      LLM_PROVIDER === "openai" ? await callOpenAI(prompt) : await callAnthropic(prompt);
    return { ...result, source: "LLM" };
  } catch (err) {
    console.error("[compatibility-engine] LLM call failed, using fallback:", err.message);
    return { ...ruleBasedScore(listing, tenantProfile), source: "RULE_BASED_FALLBACK" };
  }
}

module.exports = { computeCompatibility, buildPrompt, ruleBasedScore };
