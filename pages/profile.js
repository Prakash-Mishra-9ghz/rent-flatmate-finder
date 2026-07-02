import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/useUser";

export default function Profile() {
  const { user, loading, refresh } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({
    preferredLocation: "",
    budgetMin: "",
    budgetMax: "",
    moveInDate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "TENANT") router.push("/");
  }, [user, loading]);

  useEffect(() => {
    if (user?.tenantProfile) {
      const p = user.tenantProfile;
      setForm({
        preferredLocation: p.preferredLocation || "",
        budgetMin: p.budgetMin ?? "",
        budgetMax: p.budgetMax ?? "",
        moveInDate: p.moveInDate ? p.moveInDate.slice(0, 10) : "",
        notes: p.notes || "",
      });
    }
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      await refresh();
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container" style={{ maxWidth: 540 }}>
      <h2>My Tenant Profile</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        This is used to compute AI compatibility scores with listings.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {success && (
        <div style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 14 }}>
          ✓ Profile saved! Compatibility scores will be refreshed. <a href="/listings">Browse listings →</a>
        </div>
      )}
      <form className="card" onSubmit={submit}>
        <div className="form-group">
          <label>Preferred Location</label>
          <input required placeholder="e.g. Indiranagar, Bangalore"
            value={form.preferredLocation}
            onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Budget Min (₹/mo)</label>
            <input required type="number" min="0" value={form.budgetMin}
              onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Budget Max (₹/mo)</label>
            <input required type="number" min="0" value={form.budgetMax}
              onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Preferred Move-in Date</label>
          <input required type="date" value={form.moveInDate}
            onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Additional Notes (optional)</label>
          <textarea rows={3} placeholder="e.g. vegetarian, non-smoker, work from home..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button className="btn" disabled={busy} type="submit">
          {busy ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
