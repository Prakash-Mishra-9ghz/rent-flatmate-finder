import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../lib/useUser";
import ScoreBadge from "../../components/ScoreBadge";

export default function ListingDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useUser();
  const [listing, setListing] = useState(null);
  const [compat, setCompat] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [interestSent, setInterestSent] = useState(false);
  const [interestError, setInterestError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/listings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setListing(data.listing);
        setCompat(data.compatibility);
        setFetching(false);
      })
      .catch(() => setFetching(false));
  }, [id]);

  const expressInterest = async () => {
    setInterestError("");
    setBusy(true);
    try {
      const res = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send interest");
      setInterestSent(true);
    } catch (err) {
      setInterestError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || fetching) return <div className="container"><p>Loading…</p></div>;
  if (!listing) return <div className="container"><p>Listing not found.</p></div>;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <button className="btn secondary" onClick={() => router.back()} style={{ marginBottom: 16 }}>← Back</button>

      <div className="card">
        {listing.photos?.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {listing.photos.map((url, i) => (
              <img key={i} src={url} alt="Room photo"
                style={{ width: 180, height: 120, objectFit: "cover", borderRadius: 8 }}
                onError={(e) => (e.target.style.display = "none")} />
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>{listing.location}</h2>
            <div style={{ marginBottom: 10 }}>
              <span className="tag">{listing.roomType?.replace(/_/g, " ")}</span>
              <span className="tag">{listing.furnishingStatus?.replace(/_/g, " ")}</span>
              <span className="tag">From {new Date(listing.availableFrom).toLocaleDateString()}</span>
              {listing.isFilled && <span className="tag" style={{ background: "#fee2e2", color: "#991b1b" }}>Filled</span>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>₹{listing.rent.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>per month</div>
          </div>
        </div>

        {listing.description && (
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.6 }}>{listing.description}</p>
        )}

        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12, marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Listed by <strong>{listing.owner?.name}</strong>
          </div>
        </div>
      </div>

      {/* AI Compatibility Card */}
      {user?.role === "TENANT" && compat && (
        <div className="card" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>AI Compatibility Score</span>
            <ScoreBadge score={compat.score} />
            {compat.source === "RULE_BASED_FALLBACK" && (
              <span style={{ fontSize: 11, background: "#fef9c3", color: "#854d0e", padding: "2px 6px", borderRadius: 999 }}>
                rule-based fallback
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "#1e40af", margin: 0 }}>{compat.explanation}</p>
        </div>
      )}

      {user?.role === "TENANT" && !listing.isFilled && (
        <div className="card">
          {interestSent ? (
            <div style={{ color: "#166534", fontWeight: 600 }}>
              ✓ Interest request sent! You'll be notified when the owner responds.
            </div>
          ) : (
            <>
              {interestError && <div className="error-banner">{interestError}</div>}
              <button className="btn" disabled={busy} onClick={expressInterest}>
                {busy ? "Sending..." : "Express Interest"}
              </button>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8, marginBottom: 0 }}>
                The owner will be notified and can accept or decline your request.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
