import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/useUser";
import Link from "next/link";

export default function InterestsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [interests, setInterests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionBusy, setActionBusy] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading]);

  const fetchInterests = async () => {
    setFetching(true);
    const res = await fetch("/api/interests");
    const data = await res.json();
    setInterests(data.interests || []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && user) fetchInterests();
  }, [user, loading]);

  const respond = async (interestId, action) => {
    setActionBusy((prev) => ({ ...prev, [interestId]: true }));
    await fetch(`/api/interests/${interestId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchInterests();
    setActionBusy((prev) => ({ ...prev, [interestId]: false }));
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;

  const title = user?.role === "TENANT" ? "My Interest Requests" : "Received Interest Requests";

  return (
    <div className="container">
      <h2>{title}</h2>

      {fetching && <p style={{ color: "#6b7280" }}>Loading…</p>}

      {!fetching && interests.length === 0 && (
        <div className="empty-state">
          <p>{user?.role === "TENANT" ? "You haven't expressed interest in any listings yet." : "No tenants have expressed interest in your listings yet."}</p>
          {user?.role === "TENANT" && <Link href="/listings" className="btn">Browse Listings</Link>}
        </div>
      )}

      {!fetching && interests.map((interest) => (
        <div key={interest.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              {/* Owner sees tenant info; tenant sees listing info */}
              {user?.role === "OWNER" && (
                <div style={{ marginBottom: 6 }}>
                  <strong>{interest.tenant?.name}</strong>
                  <span style={{ color: "#6b7280", fontSize: 13, marginLeft: 8 }}>{interest.tenant?.email}</span>
                </div>
              )}
              <div style={{ fontSize: 14, marginBottom: 6 }}>
                <strong>Listing:</strong> {interest.listing?.location} · ₹{interest.listing?.rent}/mo
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`status-pill status-${interest.status}`}>{interest.status}</span>
                {interest.score != null && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    AI Score: <strong>{interest.score}/100</strong>
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {new Date(interest.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {user?.role === "OWNER" && interest.status === "PENDING" && (
                <>
                  <button
                    className="btn success"
                    style={{ fontSize: 13 }}
                    disabled={actionBusy[interest.id]}
                    onClick={() => respond(interest.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    className="btn danger"
                    style={{ fontSize: 13 }}
                    disabled={actionBusy[interest.id]}
                    onClick={() => respond(interest.id, "decline")}
                  >
                    Decline
                  </button>
                </>
              )}
              {interest.status === "ACCEPTED" && (
                <Link href={`/chat/${interest.id}`} className="btn" style={{ fontSize: 13 }}>
                  💬 Open Chat
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
