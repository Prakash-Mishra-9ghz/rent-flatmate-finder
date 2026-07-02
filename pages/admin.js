import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/useUser";

export default function AdminPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [activity, setActivity] = useState(null);
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "ADMIN") router.push("/");
  }, [user, loading]);

  const fetchActivity = async () => {
    const res = await fetch("/api/admin/activity");
    const data = await res.json();
    setActivity(data);
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  };

  useEffect(() => {
    if (!loading && user && user.role === "ADMIN") {
      Promise.all([fetchActivity(), fetchUsers()]).finally(() => setFetching(false));
    }
  }, [user, loading]);

  const toggleUser = async (userId, current) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isActive: !current }),
    });
    fetchUsers();
  };

  if (loading || fetching) return <div className="container"><p>Loading…</p></div>;

  const stats = activity?.stats || {};

  return (
    <div className="container">
      <h2>Admin Dashboard</h2>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["overview", "users"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "btn" : "btn secondary"}
            style={{ textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Stats grid */}
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
            {[
              { label: "Total Users", value: stats.userCount },
              { label: "Listings", value: stats.listingCount },
              { label: "Filled", value: stats.filledCount },
              { label: "Interest Requests", value: stats.interestCount },
              { label: "Accepted", value: stats.acceptedCount },
              { label: "Messages Sent", value: stats.messageCount },
            ].map(({ label, value }) => (
              <div key={label} className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>{value ?? "—"}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
              </div>
            ))}
          </div>

          <h3>Recent Interest Requests</h3>
          {(activity?.recentInterests || []).map((i) => (
            <div key={i.id} className="card" style={{ fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>{i.tenant?.name}</strong>
                  <span style={{ color: "#6b7280", marginLeft: 6 }}>{i.tenant?.email}</span>
                  <span style={{ margin: "0 6px", color: "#9ca3af" }}>→</span>
                  <strong>{i.listing?.location}</strong>
                  <span style={{ color: "#6b7280", marginLeft: 6 }}>₹{i.listing?.rent}/mo</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`status-pill status-${i.status}`}>{i.status}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(i.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "users" && (
        <>
          <h3>All Users ({users.length})</h3>
          {users.map((u) => (
            <div key={u.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{u.name}</strong>
                  <span style={{ color: "#6b7280", fontSize: 13, marginLeft: 8 }}>{u.email}</span>
                  <span className="tag" style={{ marginLeft: 8 }}>{u.role}</span>
                  {!u.isActive && (
                    <span className="tag" style={{ background: "#fee2e2", color: "#991b1b" }}>Deactivated</span>
                  )}
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                    {u._count?.listings || 0} listing(s) · {u._count?.interestsSent || 0} interest(s) · Joined {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className={`btn ${u.isActive ? "danger" : "success"}`}
                  style={{ fontSize: 13 }}
                  onClick={() => toggleUser(u.id, u.isActive)}
                >
                  {u.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
