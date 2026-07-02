import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../../lib/useUser";
import Link from "next/link";

export default function OwnerListings() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [listings, setListings] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "OWNER") router.push("/");
  }, [user, loading]);

  const fetchListings = async () => {
    setFetching(true);
    const res = await fetch("/api/listings?mine=true");
    const data = await res.json();
    setListings(data.listings || []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && user) fetchListings();
  }, [user, loading]);

  const toggleFilled = async (listing) => {
    await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFilled: !listing.isFilled }),
    });
    fetchListings();
  };

  const deleteListing = async (id) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    fetchListings();
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>My Listings</h2>
        <Link href="/owner/listings/new" className="btn">+ New Listing</Link>
      </div>

      {fetching && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {!fetching && listings.length === 0 && (
        <div className="empty-state">
          <p>You haven't posted any listings yet.</p>
          <Link href="/owner/listings/new" className="btn">Post your first listing</Link>
        </div>
      )}

      {!fetching && listings.map((l) => (
        <div key={l.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <strong style={{ fontSize: 15 }}>{l.location}</strong>
                {l.isFilled && (
                  <span className="tag" style={{ background: "#fee2e2", color: "#991b1b" }}>Filled</span>
                )}
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
                <span className="tag">₹{l.rent}/mo</span>
                <span className="tag">{l.roomType?.replace(/_/g, " ")}</span>
                <span className="tag">{l.furnishingStatus?.replace(/_/g, " ")}</span>
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                {l._count?.interests || 0} interest request(s) · Posted {new Date(l.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link href={`/owner/listings/${l.id}/edit`} className="btn secondary" style={{ fontSize: 13 }}>Edit</Link>
              <button className={`btn ${l.isFilled ? "secondary" : "success"}`} style={{ fontSize: 13 }}
                onClick={() => toggleFilled(l)}>
                {l.isFilled ? "Mark Available" : "Mark Filled"}
              </button>
              <button className="btn danger" style={{ fontSize: 13 }} onClick={() => deleteListing(l.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
