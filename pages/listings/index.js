import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../lib/useUser";
import ScoreBadge from "../../components/ScoreBadge";
import Link from "next/link";

export default function Listings() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [listings, setListings] = useState([]);
  const [warning, setWarning] = useState("");
  const [fetching, setFetching] = useState(true);
  const [filters, setFilters] = useState({ location: "", budgetMin: "", budgetMax: "" });
  const [applied, setApplied] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading]);

  const fetchListings = async (params = {}) => {
    setFetching(true);
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ""))
    ).toString();
    try {
      const res = await fetch(`/api/listings?${qs}`);
      const data = await res.json();
      setListings(data.listings || []);
      setWarning(data.warning || "");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && user) fetchListings();
  }, [user, loading]);

  const applyFilters = (e) => {
    e.preventDefault();
    setApplied(filters);
    fetchListings(filters);
  };

  const clearFilters = () => {
    const empty = { location: "", budgetMin: "", budgetMax: "" };
    setFilters(empty);
    setApplied({});
    fetchListings({});
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Browse Listings</h2>
        {user?.role === "TENANT" && !user?.tenantProfile && (
          <Link href="/profile" className="btn">Set up profile for AI scores</Link>
        )}
      </div>

      {warning && <div className="warning-banner">⚠️ {warning}</div>}

      {/* Filters */}
      <form className="card" onSubmit={applyFilters} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", padding: 14 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 160px" }}>
          <label>Location</label>
          <input placeholder="e.g. Koramangala"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 120px" }}>
          <label>Min Budget</label>
          <input type="number" min="0" placeholder="₹"
            value={filters.budgetMin}
            onChange={(e) => setFilters({ ...filters, budgetMin: e.target.value })} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 120px" }}>
          <label>Max Budget</label>
          <input type="number" min="0" placeholder="₹"
            value={filters.budgetMax}
            onChange={(e) => setFilters({ ...filters, budgetMax: e.target.value })} />
        </div>
        <button className="btn" type="submit">Filter</button>
        <button className="btn secondary" type="button" onClick={clearFilters}>Clear</button>
      </form>

      {fetching && <p style={{ color: "#6b7280" }}>Loading listings…</p>}

      {!fetching && listings.length === 0 && (
        <div className="empty-state"><p>No listings found matching your criteria.</p></div>
      )}

      {!fetching && listings.map((l) => (
        <Link key={l.id} href={`/listings/${l.id}`} style={{ textDecoration: "none" }}>
          <div className="card" style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <strong style={{ fontSize: 16 }}>{l.location}</strong>
                {l.compatibility && <ScoreBadge score={l.compatibility.score} />}
              </div>
              <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 6 }}>
                <span className="tag">₹{l.rent}/mo</span>
                <span className="tag">{l.roomType?.replace("_", " ")}</span>
                <span className="tag">{l.furnishingStatus?.replace("_", " ")}</span>
                <span className="tag">From {new Date(l.availableFrom).toLocaleDateString()}</span>
              </div>
              {l.compatibility?.explanation && (
                <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                  {l.compatibility.explanation.slice(0, 120)}{l.compatibility.explanation.length > 120 ? "…" : ""}
                  {l.compatibility.source === "RULE_BASED_FALLBACK" && (
                    <span style={{ color: "#d97706", marginLeft: 6 }}>[rule-based]</span>
                  )}
                </div>
              )}
              {l.description && (
                <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
                  {l.description.slice(0, 100)}{l.description.length > 100 ? "…" : ""}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#2563eb" }}>₹{l.rent.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>per month</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>by {l.owner?.name}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
